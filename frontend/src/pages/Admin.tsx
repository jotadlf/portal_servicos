import { useRef, useState, type FormEvent } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { BottomMenu } from '../components/BottomMenu'
import { LoginBar } from '../components/LoginBar'
import { PageBar } from '../components/PageBar'
import { StackedBar } from '../components/graficos/StackedBar'
import { LoadError, Loading } from '../components/Status'
import { fetchStats, type RankingRow, type Stats } from '../features/admin/estatisticas'
import { formatMoney, gateways, type PaymentGateway, type PlanSettings } from '../features/conta/plano'
import { fetchPlanSettings, savePlanSettings } from '../features/conta/plano-api'
import type { Account } from '../features/conta/usuario'
import {
  addProfession,
  fetchCatalog,
  removeProfession,
  type Profession,
} from '../features/servicos/catalogo'
import { useApi } from '../hooks/useApi'
import { ApiError, errorMessage } from '../lib/api'
import { normalize } from '../lib/format'
import { isValidName } from '../lib/nome'

const tabs = [
  { id: 'painel', label: 'Painel' },
  { id: 'modalidades', label: 'Modalidades' },
  { id: 'plano', label: 'Plano e pagamentos' },
] as const

type TabId = (typeof tabs)[number]['id']

type AdminProps = {
  account?: Account
  onLogin: () => void
}

export function Admin({ account, onLogin }: AdminProps) {
  const [tab, setTab] = useState<TabId>('painel')

  return (
    <div className="app">
      <PageBar title="Administração" />
      <main className="page admin-page">
        {!account && <LoginBar message="Entre com a conta de administração." onLogin={onLogin} />}

        {account && !account.isAdmin && (
          <div className="empty">
            <p>Esta área é só para a administração do portal.</p>
          </div>
        )}

        {account?.isAdmin && (
          <>
            <nav className="tabs" aria-label="Seções da administração">
              {tabs.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`tab${tab === id ? ' is-active' : ''}`}
                  aria-pressed={tab === id}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </nav>

            {tab === 'painel' && <Painel />}
            {tab === 'modalidades' && <Modalidades />}
            {tab === 'plano' && <PlanoForm />}
          </>
        )}
      </main>

      {account?.isAdmin && <BottomMenu current="admin" showAdmin />}
    </div>
  )
}

// Cores dos gráficos, validadas para daltonismo e contraste sobre o branco
const CHART = {
  primary: '#00897b',
  tertiary: '#2a78d6',
  muted: '#b9c6c3',
}

function Painel() {
  const data = useApi(fetchStats)
  if (data.loading && !data.data) return <Loading />
  if (!data.data) return <LoadError message={data.error ?? ''} onRetry={data.reload} />
  return <PainelView stats={data.data.stats} ranking={data.data.ranking} />
}

// Quantas modalidades aparecem no ranking do painel
const TOP_MODALITIES = 5

function PainelView({ stats, ranking }: { stats: Stats; ranking: RankingRow[] }) {
  const top = [...ranking].sort((a, b) => b.services - a.services).slice(0, TOP_MODALITIES)
  const max = Math.max(1, ...top.map(({ services }) => services))
  const count = (value: number) => value.toLocaleString('pt-BR')

  const tiles = [
    { label: 'Pessoas', value: count(stats.people) },
    { label: 'Prestadores publicados', value: count(stats.published) },
    { label: 'Serviços', value: count(stats.services) },
    { label: 'Receita mensal', value: formatMoney(stats.monthlyRevenue) },
  ]

  return (
    <>
      <section className="kpi-grid" aria-label="Números de agora">
        {tiles.map(({ label, value }) => (
          <div key={label} className="stat-tile">
            <span className="stat-label">{label}</span>
            <strong className="stat-value">{value}</strong>
          </div>
        ))}
      </section>

      <div className="dash-grid">
        <section className="chart-card" aria-labelledby="g-situacao">
          <h3 id="g-situacao">Prestadores</h3>
          <StackedBar
            label={`Prestadores: ${stats.paying} pagando, ${stats.inTrial} no período grátis, ${stats.drafts} em rascunho`}
            segments={[
              { name: 'Pagando', value: stats.paying, color: CHART.primary },
              { name: 'Período grátis', value: stats.inTrial, color: CHART.tertiary },
              { name: 'Rascunho', value: stats.drafts, color: CHART.muted },
            ]}
          />
        </section>

        <section className="chart-card" aria-labelledby="g-modalidades">
          <h3 id="g-modalidades">Top modalidades</h3>
          <ul className="bar-list">
            {top.map(({ professionId, name, services }) => (
              <li key={professionId}>
                <span className="bar-label">{name}</span>
                <span className="bar-track" aria-hidden="true">
                  <span className="bar-fill" style={{ width: `${(services / max) * 100}%` }} />
                </span>
                <span className="bar-value">{services}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

function Modalidades() {
  // Catálogo + quantos serviços cada modalidade tem (para avisar antes de remover)
  const data = useApi(() => Promise.all([fetchCatalog(), fetchStats()]))
  if (data.loading && !data.data) return <Loading />
  if (!data.data) return <LoadError message={data.error ?? ''} onRetry={data.reload} />

  const [professions, { ranking }] = data.data
  const usage = new Map(ranking.map((item) => [item.professionId, item]))
  const refresh = data.reload

  return (
    <>
      <NovaModalidade professions={professions} onAdded={refresh} />

      <section className="page-section" aria-labelledby="modalidades-titulo">
        <h2 id="modalidades-titulo">{professions.length} modalidades no catálogo</h2>
        <ul className="line-list">
          {professions.map((profession) => (
            <ModalidadeItem
              key={profession.id}
              profession={profession}
              services={usage.get(profession.id)?.services ?? 0}
              providers={usage.get(profession.id)?.providers ?? 0}
              onRemoved={refresh}
            />
          ))}
        </ul>
      </section>
    </>
  )
}

type ModalidadeItemProps = {
  profession: Profession
  services: number
  providers: number
  onRemoved: () => void
}

function ModalidadeItem({ profession, services, providers, onRemoved }: ModalidadeItemProps) {
  // Remover pede confirmação, dizendo quantos serviços somem junto
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const Icon = profession.icon

  // Os serviços da modalidade saem junto, no servidor
  async function remove() {
    setBusy(true)
    setError('')
    try {
      await removeProfession(profession.id)
      onRemoved()
    } catch (failure) {
      setError(errorMessage(failure))
      setBusy(false)
    }
  }

  return (
    <li className="line modality">
      <span className="modality-icon">
        {profession.image ? (
          <img src={profession.image} alt="" width={28} height={28} />
        ) : (
          <Icon size={22} aria-hidden="true" />
        )}
      </span>
      <span className="service-name">
        {profession.name}
        <small>
          {services} {services === 1 ? 'serviço' : 'serviços'} de {providers}{' '}
          {providers === 1 ? 'prestador' : 'prestadores'}
        </small>
        {error && <small className="form-error">{error}</small>}
      </span>
      {confirming ? (
        <span className="modality-confirm">
          <button type="button" className="clear-filters" onClick={() => setConfirming(false)}>
            Cancelar
          </button>
          <button type="button" className="danger-button" disabled={busy} onClick={remove}>
            {services > 0 ? `Remover e apagar ${services} serviços` : 'Remover'}
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="icon-button"
          aria-label={`Remover ${profession.name}`}
          onClick={() => setConfirming(true)}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      )}
    </li>
  )
}

// PNG ou WebP; SVG fica de fora porque pode carregar script
const MODALITY_IMAGE_TYPES = ['image/png', 'image/webp']

function NovaModalidade({ professions, onAdded }: { professions: Profession[]; onAdded: () => void }) {
  const [name, setName] = useState('')
  const [tasks, setTasks] = useState('')
  // Arquivo para enviar e a prévia dele na tela
  const [image, setImage] = useState<{ file: File; preview: string }>()
  const [error, setError] = useState('')
  const [added, setAdded] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    // Uma sugestão de serviço por linha
    const list = tasks
      .split('\n')
      .map((task) => task.trim())
      .filter(Boolean)

    if (!trimmed) {
      setError('Informe o nome da modalidade.')
      return
    }
    // Nome de profissão segue a regra dos nomes de pessoa: "Marceneiro", "Técnico de Ar-condicionado"
    if (!isValidName(trimmed)) {
      setError('Use só letras no nome da modalidade, sem números ou símbolos.')
      return
    }
    if (professions.some((profession) => normalize(profession.name) === normalize(trimmed))) {
      setError('Já existe uma modalidade com esse nome.')
      return
    }
    if (list.length === 0) {
      setError('Informe pelo menos um serviço, para a modalidade aparecer na busca.')
      return
    }

    if (busy) return
    setBusy(true)
    try {
      await addProfession({ name: trimmed, tasks: list, image: image?.file })
    } catch (failure) {
      setError(errorMessage(failure))
      setBusy(false)
      return
    }
    setBusy(false)
    setAdded(trimmed)
    setName('')
    setTasks('')
    setImage(undefined)
    onAdded()
  }

  return (
    <form
      className="page-section form admin-card"
      onSubmit={handleSubmit}
      onChange={() => {
        setError('')
        setAdded('')
      }}
      noValidate
    >
      <h2>Nova modalidade</h2>

      <div className="modality-new">
        <button
          type="button"
          className="modality-image"
          aria-label={image ? 'Trocar imagem' : 'Adicionar imagem'}
          onClick={() => fileRef.current?.click()}
        >
          {image ? <img src={image.preview} alt="" /> : <ImagePlus size={24} aria-hidden="true" />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={MODALITY_IMAGE_TYPES.join(',')}
          aria-label="Imagem da modalidade"
          hidden
          onChange={(e) => {
            // O onChange do formulário apaga os avisos; aqui o aviso é justamente sobre o arquivo
            e.stopPropagation()
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            if (!MODALITY_IMAGE_TYPES.includes(file.type)) {
              setError('Escolha uma imagem PNG ou WebP.')
              return
            }
            setImage({ file, preview: URL.createObjectURL(file) })
          }}
        />
        <label className="field">
          <span>Nome</span>
          <input
            maxLength={40}
            placeholder="Ex.: Marceneiro"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      </div>
      <small className="field-help">Imagem opcional (PNG ou WebP).</small>

      <label className="field">
        <span>Serviços sugeridos (um por linha)</span>
        <textarea
          rows={4}
          placeholder={'Montar móvel sob medida\nConsertar porta de armário'}
          value={tasks}
          onChange={(e) => setTasks(e.target.value)}
        />
      </label>

      <div aria-live="polite">
        {error && <p className="form-error">{error}</p>}
        {added && (
          <p className="form-ready">
            {added} foi adicionada. Aparece na página inicial quando algum prestador oferecer um serviço dela.
          </p>
        )}
      </div>

      <button type="submit" className="primary" disabled={busy}>
        {busy ? 'Adicionando…' : 'Adicionar modalidade'}
      </button>
    </form>
  )
}

// "19,90", "19.90" e "1.234,50" viram número; texto inválido vira NaN.
// Com vírgula, o ponto é de milhar; sem vírgula, o ponto é dos centavos.
function parseMoney(value: string) {
  const text = value.trim()
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : NaN
}

function moneyInput(value: number) {
  return value.toFixed(2).replace('.', ',')
}

function PlanoForm() {
  const data = useApi(fetchPlanSettings)
  if (data.loading && !data.data) return <Loading />
  if (!data.data) return <LoadError message={data.error ?? ''} onRetry={data.reload} />
  return <PlanoFields settings={data.data} />
}

function PlanoFields({ settings }: { settings: PlanSettings }) {
  const [busy, setBusy] = useState(false)
  const [monthly, setMonthly] = useState(moneyInput(settings.monthlyPrice))
  const [semiannual, setSemiannual] = useState(moneyInput(settings.semiannualPrice))
  const [trialDays, setTrialDays] = useState(String(settings.trialDays))
  const [gateway, setGateway] = useState<PaymentGateway>(settings.gateway)
  const [pixEnabled, setPixEnabled] = useState(settings.pixEnabled)
  const [cardEnabled, setCardEnabled] = useState(settings.cardEnabled)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const monthlyValue = parseMoney(monthly)
  const semiannualValue = parseMoney(semiannual)
  const discount =
    monthlyValue > 0 && semiannualValue > 0
      ? Math.round((1 - semiannualValue / (monthlyValue * 6)) * 100)
      : null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const days = Number(trialDays)

    if (!(monthlyValue > 0) || !(semiannualValue > 0)) {
      setError('Informe os preços em reais, por exemplo 19,90.')
      return
    }
    if (!Number.isInteger(days) || days < 0 || days > 90) {
      setError('O período grátis precisa ser de 0 a 90 dias.')
      return
    }
    if (!pixEnabled && !cardEnabled) {
      setError('Deixe pelo menos uma forma de pagamento ligada.')
      return
    }

    // Vale para quem publicar daqui em diante.
    // TODO: no gateway, novos preços exigem um plano novo; assinaturas antigas mantêm o valor.
    setBusy(true)
    try {
      await savePlanSettings({
        monthlyPrice: monthlyValue,
        semiannualPrice: semiannualValue,
        trialDays: days,
        gateway,
        pixEnabled,
        cardEnabled,
      })
      setSaved(true)
    } catch (failure) {
      const fields = failure instanceof ApiError ? Object.values(failure.fields) : []
      setError(fields[0] ?? errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="page-section form"
      onSubmit={handleSubmit}
      onChange={() => {
        setError('')
        setSaved(false)
      }}
      noValidate
    >
      <section className="admin-card form">
        <h2>Plano de prestador</h2>
        <div className="address-row">
          <label className="field">
            <span>Mensal (R$)</span>
            <input inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          </label>
          <label className="field">
            <span>Semestral (R$)</span>
            <input
              inputMode="decimal"
              value={semiannual}
              onChange={(e) => setSemiannual(e.target.value)}
            />
          </label>
        </div>
        <small className="field-help">
          {discount === null
            ? 'Preços em reais, com vírgula nos centavos.'
            : discount > 0
              ? `O semestral sai ${discount}% mais barato que 6 meses do mensal.`
              : 'Atenção: o semestral não está mais barato que 6 meses do mensal.'}
        </small>

        <label className="field">
          <span>Dias grátis ao publicar</span>
          <input
            inputMode="numeric"
            maxLength={2}
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value.replace(/\D/g, ''))}
          />
        </label>
      </section>

      <section className="admin-card form">
        <h2>Pagamentos</h2>
        <label className="field">
          <span>Gateway de pagamento</span>
          <select value={gateway} onChange={(e) => setGateway(e.target.value as PaymentGateway)}>
            {gateways.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="toggle-group">
          <legend>Formas de pagamento aceitas</legend>
          <label className="toggle">
            <input
              type="checkbox"
              checked={pixEnabled}
              onChange={(e) => setPixEnabled(e.target.checked)}
            />
            Pix (cobrança automática)
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={cardEnabled}
              onChange={(e) => setCardEnabled(e.target.checked)}
            />
            Cartão de crédito
          </label>
        </fieldset>
      </section>

      <div aria-live="polite">
        {error && <p className="form-error">{error}</p>}
        {saved && (
          <p className="form-ready">Configurações salvas.</p>
        )}
      </div>

      <button type="submit" className="primary" disabled={busy}>
        {busy ? 'Salvando…' : 'Salvar configurações'}
      </button>
    </form>
  )
}
