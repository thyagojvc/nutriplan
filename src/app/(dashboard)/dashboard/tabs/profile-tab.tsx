import { ProfileCard, ImcBadge, ImcScale, ACTIVITY_LABEL, GOAL_LABEL, type Profile } from '../dashboard-ui'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '👋'
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
}

export function ProfileTab({
  name,
  goal,
  profile,
}: {
  name: string
  goal: string
  profile?: Profile
}) {
  const imc =
    profile?.weightKg && profile?.heightCm
      ? profile.weightKg / Math.pow(profile.heightCm / 100, 2)
      : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-black text-white shadow-[0_4px_16px_rgba(15,110,86,0.28)]">
          {initials(name || 'Tu')}
        </div>
        <div>
          <p className="font-display text-[19px] font-black text-foreground">{name || 'Hola'}</p>
          <p className="text-sm text-muted-foreground">
            Tu meta: <span className="font-semibold text-primary">{GOAL_LABEL[goal] ?? goal}</span>
          </p>
        </div>
      </div>

      {profile && (
        <section className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <ProfileCard icon="👩" label="Edad" value={profile.age ? `${profile.age} años` : '—'} />
            <ProfileCard icon="⚖️" label="Peso" value={profile.weightKg ? `${profile.weightKg} kg` : '—'} />
            <ProfileCard icon="📏" label="Altura" value={profile.heightCm ? `${profile.heightCm} cm` : '—'} />
            <ProfileCard icon="🧮" label="IMC" value={imc ? imc.toFixed(1) : '—'} highlight={!!imc} />
            <ProfileCard icon="🎯" label="Objetivo" value={GOAL_LABEL[goal] ?? goal} />
            <ProfileCard icon="⚡" label="Actividad" value={ACTIVITY_LABEL[profile.activityLevel] ?? (profile.activityLevel || '—')} />
          </div>
          {imc && (
            <div className="space-y-2 rounded-2xl border border-[#D8E8D4] bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Tu IMC</p>
                <ImcBadge imc={imc} />
              </div>
              <ImcScale imc={imc} />
            </div>
          )}
        </section>
      )}
    </div>
  )
}
