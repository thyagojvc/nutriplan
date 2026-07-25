'use client'

import { useState } from 'react'
import type { NutritionPlanJson } from '@/lib/nutrition/types'
import type { TrainingPlanJson } from '@/lib/nutrition/generate'
import type { Profile } from './dashboard-ui'
import { TabBar, type TabId } from './tab-bar'
import { PlanTab } from './tabs/plan-tab'
import { ListTab } from './tabs/list-tab'
import { BonusTab } from './tabs/bonus-tab'
import { TrainingTab } from './tabs/training-tab'
import { ProfileTab } from './tabs/profile-tab'

const TAB_TITLE: Record<TabId, string> = {
  plan: 'Tu plan personalizado',
  lista: 'Lista y guía',
  bonos: 'Tus bonos',
  entrenamiento: 'Entrenamiento',
  perfil: 'Perfil',
}

export function DashboardShell({
  plan,
  name,
  profile,
  docKinds = [],
  docUrls = {},
  devPdfHref,
  trainingPlan,
  orderId,
  trainingCheckoutUrl,
}: {
  plan: NutritionPlanJson
  name: string
  profile?: Profile
  docKinds?: string[]
  docUrls?: Record<string, string>
  devPdfHref?: string
  trainingPlan: TrainingPlanJson | null
  orderId: string
  trainingCheckoutUrl?: string
}) {
  const [tab, setTab] = useState<TabId>('plan')

  // Só existe um link de download se o documento já foi gerado (generated_documents).
  const docHref = (kind: string): string | undefined =>
    docKinds.includes(kind) ? (docUrls[kind] ?? devPdfHref ?? `/api/documents/${kind}`) : undefined

  const hasTraining = !!trainingPlan
  const hasRecipes = docKinds.includes('recipes')

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Top bar persistente */}
      <header className="sticky top-0 z-20 border-b border-[#EAF2E6] bg-[#FBFAF6]/95 px-4 py-3 backdrop-blur-md">
        <h1 className="text-center font-display text-[17px] font-black leading-tight text-foreground">
          {TAB_TITLE[tab]}
        </h1>
      </header>

      <div className="p-4 pb-24">
        {tab === 'plan' && <PlanTab plan={plan} profile={profile} />}
        {tab === 'lista' && (
          <ListTab plan={plan} nutritionPdfHref={docHref('nutrition_plan')} />
        )}
        {tab === 'bonos' && (
          <BonusTab
            antiCelulitisHref={docHref('anti_celulitis')}
            recipesHref={hasRecipes ? docHref('recipes') : undefined}
          />
        )}
        {tab === 'entrenamiento' && (
          <TrainingTab
            trainingPlan={trainingPlan}
            trainingPdfHref={docHref('training_plan')}
            checkoutUrl={trainingCheckoutUrl}
            orderId={orderId}
          />
        )}
        {tab === 'perfil' && <ProfileTab name={name} goal={plan.summary.goal} profile={profile} />}
      </div>

      <TabBar active={tab} onChange={setTab} showTrainingBadge={!hasTraining} />
    </div>
  )
}
