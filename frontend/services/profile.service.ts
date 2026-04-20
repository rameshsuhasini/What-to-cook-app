import api from '@/lib/axios'

const formApi = api

export type DietType = 'NONE' | 'VEGETARIAN' | 'VEGAN' | 'KETO' | 'PALEO'
export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE'

export interface UserProfile {
  id: string
  userId: string
  age: number | null
  gender: Gender | null
  heightCm: number | null
  activityLevel: ActivityLevel | null
  weightKg: number | null
  targetWeightKg: number | null
  dietType: DietType
  calorieGoal: number | null
  proteinGoal: number | null
  carbGoal: number | null
  fatGoal: number | null
  healthConditions: string | null
  allergies: string | null
  foodPreferences: string | null
  avatarUrl: string | null
}

export interface UpdateProfilePayload {
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
}

export const profileApi = {
  getProfile: async (): Promise<UserProfile> => {
    const res = await api.get('/profile')
    return res.data.data.profile
  },

  updateProfile: async (payload: UpdateProfilePayload): Promise<UserProfile> => {
    const res = await api.put('/profile', payload)
    return res.data.data.profile
  },

  uploadAvatar: async (file: File): Promise<UserProfile> => {
    const form = new FormData()
    form.append('avatar', file)
    const res = await formApi.post('/profile/avatar', form)
    return res.data.data.profile
  },
}
