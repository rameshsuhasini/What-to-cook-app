import { DietType, Gender, ActivityLevel } from '@prisma/client'

export interface UpdateProfileDTO {
  age?: number | null
  gender?: Gender | null
  heightCm?: number | null
  activityLevel?: ActivityLevel | null
  weightKg?: number | null
  targetWeightKg?: number | null
  dietType?: DietType
  calorieGoal?: number | null
  proteinGoal?: number | null
  carbGoal?: number | null
  fatGoal?: number | null
  healthConditions?: string | null
  allergies?: string | null
  foodPreferences?: string | null
  avatarUrl?: string | null
}
