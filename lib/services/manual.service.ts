import { connectDB } from "@/lib/db/connection";
import Project from "@/lib/db/models/Project";
import Epic, { type IEpic } from "@/lib/db/models/Epic";
import Feature, { type IFeature, type FeatureDerivedStatus } from "@/lib/db/models/Feature";
import { recomputeForecast } from "@/lib/services/forecast.service";

export interface FeaturePoints {
  totalPoints: number;
  completedPoints: number;
  derivedStatus: FeatureDerivedStatus;
}

/** Pure: derives totalPoints, completedPoints, derivedStatus for a manual-mode feature. */
export function computeFeaturePoints(storyCount: number, completedStoryCount: number, avgStoryPoints: number): FeaturePoints {
  const totalPoints = storyCount * avgStoryPoints;
  const completedPoints = Math.min(completedStoryCount, storyCount) * avgStoryPoints;
  const derivedStatus: FeatureDerivedStatus =
    completedStoryCount <= 0 ? "not_started" : completedStoryCount >= storyCount ? "complete" : "in_progress";
  return { totalPoints, completedPoints, derivedStatus };
}

/** Pure: aggregates epic totals from its features. */
export function aggregateEpicTotals(features: { totalPoints: number; completedPoints: number }[]): {
  totalPoints: number;
  completedPoints: number;
} {
  return {
    totalPoints: features.reduce((sum, f) => sum + f.totalPoints, 0),
    completedPoints: features.reduce((sum, f) => sum + f.completedPoints, 0),
  };
}

async function getAvgStoryPoints(projectId: string): Promise<number> {
  const project = await Project.findById(projectId).lean();
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project.avgStoryPoints ?? 5;
}

async function recomputeEpicTotals(epicId: string): Promise<void> {
  const features = await Feature.find({ epicId }).lean();
  const { totalPoints, completedPoints } = aggregateEpicTotals(features);
  await Epic.updateOne({ _id: epicId }, { $set: { totalPoints, completedPoints } });
}

export async function createEpic(projectId: string, title: string): Promise<IEpic> {
  await connectDB();
  const project = await Project.findById(projectId).lean();
  if (!project) throw new Error(`Project ${projectId} not found`);

  const epic = await Epic.create({
    organizationId: project.organizationId,
    projectId,
    source: "manual",
    title,
    state: "active",
    totalPoints: 0,
    completedPoints: 0,
  });

  await recomputeForecast(projectId);
  return epic;
}

export async function updateEpic(epicId: string, data: { title?: string; state?: string }): Promise<IEpic> {
  await connectDB();
  const epic = await Epic.findByIdAndUpdate(epicId, { $set: data }, { new: true });
  if (!epic) throw new Error(`Epic ${epicId} not found`);

  await recomputeForecast(epic.projectId.toString());
  return epic;
}

export async function createFeature(
  epicId: string,
  data: { title: string; storyCount: number }
): Promise<IFeature> {
  await connectDB();
  const epic = await Epic.findById(epicId).lean();
  if (!epic) throw new Error(`Epic ${epicId} not found`);

  const avgStoryPoints = await getAvgStoryPoints(epic.projectId.toString());
  const points = computeFeaturePoints(data.storyCount, 0, avgStoryPoints);

  const feature = await Feature.create({
    organizationId: epic.organizationId,
    epicId,
    projectId: epic.projectId,
    source: "manual",
    title: data.title,
    state: "active",
    storyCount: data.storyCount,
    completedStoryCount: 0,
    ...points,
  });

  await recomputeEpicTotals(epicId);
  await recomputeForecast(epic.projectId.toString());
  return feature;
}

export async function updateFeature(
  featureId: string,
  data: { title?: string; storyCount?: number; completedStoryCount?: number }
): Promise<IFeature> {
  await connectDB();
  const feature = await Feature.findById(featureId);
  if (!feature) throw new Error(`Feature ${featureId} not found`);

  const avgStoryPoints = await getAvgStoryPoints(feature.projectId.toString());
  const storyCount = data.storyCount ?? feature.storyCount ?? 0;
  const completedStoryCount = data.completedStoryCount ?? feature.completedStoryCount ?? 0;
  const points = computeFeaturePoints(storyCount, completedStoryCount, avgStoryPoints);

  if (data.title !== undefined) feature.title = data.title;
  feature.storyCount = storyCount;
  feature.completedStoryCount = completedStoryCount;
  feature.totalPoints = points.totalPoints;
  feature.completedPoints = points.completedPoints;
  feature.derivedStatus = points.derivedStatus;
  await feature.save();

  await recomputeEpicTotals(feature.epicId.toString());
  await recomputeForecast(feature.projectId.toString());
  return feature;
}

/** EM updates story-count progress each sprint. Thin wrapper over updateFeature. */
export async function updateFeatureProgress(featureId: string, completedStoryCount: number): Promise<IFeature> {
  return updateFeature(featureId, { completedStoryCount });
}

export async function deleteFeature(featureId: string): Promise<void> {
  await connectDB();
  const feature = await Feature.findByIdAndDelete(featureId);
  if (!feature) throw new Error(`Feature ${featureId} not found`);

  await recomputeEpicTotals(feature.epicId.toString());
  await recomputeForecast(feature.projectId.toString());
}
