import { useRef, useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { BottomMenu } from '../components/BottomMenu'
import { LoginBar } from '../components/LoginBar'
import { deleteAccount, updateAccount, uploadPhoto, type Account, type Address } from '../features/conta/usuario'
import { routes } from '../hooks/useHashRoute'
import { ApiError, errorMessage } from '../lib/api'
import { fetchAddress, formatCep, isValidUf } from '../lib/cep'
import { isValidName, NAME_ERROR } from '../lib/nome'
import { formatPhone, isValidPhone } from '../lib/whatsapp'

type ContaProps = {
  account?: Account
  onLogin: () => void
  onLogout: () => void
  // Conta atualizada pelo servidor (foto, nome...), para o resto do app ver
  onAccountChange: (account: Account) => void
}

export function Conta({ account, onLogin, onLogout, onAccountChange }: ContaProps) {
  return (
    <div className="app">
      <main className="page">
        {account ? (
          <>
            <PerfilForm
              key={account.id}
              account={account}
              onLogout={onLogout}
              onAccountChange={onAccountChange}
            />
            {/* O portal não pode ficar sem administração */}
            <PrivacyLinks />
            {!account.isAdmin && (
              <DeleteAccount isProvider={Boolean(account.professionalId)} onDeleted={onLogout} />
            )}
          </>
        ) : (
          <div className="page-section">
            <h1 className="page-title">Seu perfil</h1>
            <LoginBar message="Entre para ver seu perfil." onLogin={onLogin} />
            <PrivacyLinks />
          </div>
        )}
      </main>

      <BottomMenu current="conta" showAdmin={account?.isAdmin} />
    </div>
  )
}

function PrivacyLinks() {
  return (
    <nav className="privacy-links" aria-label="Termos e privacidade">
      <a href={routes.termos}>Termos de uso</a>
      <a href={routes.privacidade}>Política de privacidade</a>
      <a href={routes.contato}>Pedidos sobre seus dados</a>
    </nav>
  )
}

// Apagar a conta pede confirmação aqui mesmo, sem janela por cima. Também é o caminho
// para quem quer recomeçar do zero. CPF e data de nascimento errados se corrigem pelo pedido de contato.
function DeleteAccount({ isProvider, onDeleted }: { isProvider: boolean; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cancelRef = useRef<HTMLButtonElement>(null)
  const startRef = useRef<HTMLButtonElement>(null)

  function open() {
    setConfirming(true)
    setError('')
    // Foco no "Cancelar": a escolha segura fica à mão
    window.setTimeout(() => cancelRef.current?.focus())
  }

  function cancel() {
    setConfirming(false)
    window.setTimeout(() => startRef.current?.focus())
  }

  async function confirm() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await deleteAccount()
      window.location.hash = routes.inicio
      onDeleted()
    } catch (failure) {
      setError(errorMessage(failure))
      setBusy(false)
    }
  }

  return (
    <section className="page-section delete-account" aria-labelledby="apagar-conta-titulo">
      <h2 id="apagar-conta-titulo">Apagar conta</h2>
      {confirming ? (
        <>
          <p className="notice notice-danger">
            {isProvider
              ? 'Seu perfil público, seus serviços, os contatos e as avaliações recebidas serão apagados junto. '
              : 'Seus dados, sua foto e as avaliações que você deu serão apagados. '}
            Isso não pode ser desfeito.
          </p>
          <div aria-live="polite">{error && <p className="form-error">{error}</p>}</div>
          <div className="form-actions">
            <button ref={cancelRef} type="button" className="clear-filters" disabled={busy} onClick={cancel}>
              Cancelar
            </button>
            <button type="button" className="danger-button" disabled={busy} onClick={confirm}>
              {busy ? 'Apagando…' : 'Apagar minha conta'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="section-note">
            Apaga sua conta e tudo o que está nela. Para corrigir o CPF ou a data de nascimento, faça um{' '}
            <a href={routes.contato}>pedido de correção</a>.
          </p>
          <div>
            <button ref={startRef} type="button" className="clear-filters danger-link" onClick={open}>
              Apagar conta
            </button>
          </div>
        </>
      )}
    </section>
  )
}

type CepStatus = 'idle' | 'loading' | 'found' | 'not-found'

// Campos conferidos ao salvar, na ordem em que aparecem na tela
type FieldName = 'photo' | 'name' | 'phone' | 'cep' | 'city' | 'state'
type Errors = Partial<Record<FieldName, string>>

const MAX_PHOTO_MB = 5
// SVG fica de fora: pode carregar script. O servidor confere de novo pelo conteúdo do arquivo.
const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

type PerfilFormProps = {
  account: Account
  onLogout: () => void
  onAccountChange: (account: Account) => void
}

function PerfilForm({ account, onLogout, onAccountChange }: PerfilFormProps) {
  const [name, setName] = useState(account.name)
  const [photo, setPhoto] = useState(account.photo)
  const [phone, setPhone] = useState(formatPhone(account.phone))
  const [address, setAddress] = useState<Address>({
    ...account.address,
    cep: formatCep(account.address.cep),
  })
  const [cepStatus, setCepStatus] = useState<CepStatus>('idle')
  const [errors, setErrors] = useState<Errors>({})
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  // Erro que não é de um campo (sem conexão, servidor fora do ar)
  const [formError, setFormError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const numberRef = useRef<HTMLInputElement>(null)
  // A foto só é obrigatória para quem oferece serviços: é ela que o cliente vê no perfil
  const isProvider = Boolean(account.professionalId)

  // Só a última consulta de CEP vale, se a pessoa digitar outro antes da resposta
  const lastCepRef = useRef('')
  const cepDigits = address.cep.replace(/\D/g, '')

  // Mexer num campo apaga o aviso dele
  function clearError(field: FieldName) {
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  // Liga o campo à mensagem de erro (ou à ajuda) e acende o contorno vermelho
  function invalidProps(field: FieldName, helpId?: string) {
    const error = errors[field]
    return {
      name: field,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `${field}-erro` : helpId,
    }
  }

  function errorNote(field: FieldName) {
    const error = errors[field]
    return error ? (
      <small id={`${field}-erro`} className="form-error">
        {error}
      </small>
    ) : null
  }

  // Ao completar os 8 dígitos do CEP, preenche rua, bairro e cidade
  function changeCep(value: string) {
    const masked = formatCep(value)
    const digits = masked.replace(/\D/g, '')
    setField('cep', masked)
    lastCepRef.current = digits

    if (digits.length !== 8) {
      setCepStatus('idle')
      return
    }
    setCepStatus('loading')
    fetchAddress(digits).then((found) => {
      if (lastCepRef.current !== digits) return
      if (!found) {
        setCepStatus('not-found')
        return
      }
      setAddress((current) => ({ ...current, ...found }))
      setErrors((current) => ({ ...current, city: undefined, state: undefined }))
      setCepStatus('found')
      numberRef.current?.focus()
    })
  }

  function setField(field: keyof Address, value: string) {
    setAddress((current) => ({ ...current, [field]: value }))
  }

  async function choosePhoto(file: File | undefined) {
    if (!file) return
    // O seletor já filtra imagens, mas nem todo celular respeita
    if (!PHOTO_TYPES.includes(file.type)) {
      setErrors((current) => ({ ...current, photo: 'Escolha um arquivo de imagem, como JPG ou PNG.' }))
      return
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setErrors((current) => ({ ...current, photo: `A foto precisa ter até ${MAX_PHOTO_MB} MB.` }))
      return
    }
    // A foto vai para o banco na hora; o resto do perfil só ao salvar
    clearError('photo')
    setSaved(false)
    setPhotoBusy(true)
    try {
      const updated = await uploadPhoto(file)
      setPhoto(updated.photo)
      onAccountChange(updated)
    } catch (failure) {
      setErrors((current) => ({ ...current, photo: errorMessage(failure) }))
    } finally {
      setPhotoBusy(false)
    }
  }

  function validate(): Errors {
    const digits = phone.replace(/\D/g, '')
    const found: Errors = {}
    if (isProvider && !photo) found.photo = 'Adicione uma foto: ela aparece no seu perfil de prestador.'
    if (!name.trim()) found.name = 'Informe seu nome.'
    else if (!isValidName(name)) found.name = NAME_ERROR
    if (digits && !isValidPhone(digits)) {
      found.phone = 'Informe o WhatsApp com DDD, por exemplo (62) 99999-9999.'
    }
    // Endereço é opcional, mas o que for preenchido precisa estar certo
    if (cepDigits && cepDigits.length !== 8) found.cep = 'Complete os 8 números do CEP.'
    // Nomes de cidade seguem a mesma regra dos nomes de pessoa: "Pau-d'Arco", "Embu-Guaçu"
    if (address.city.trim() && !isValidName(address.city)) {
      found.city = 'Use só letras no nome da cidade.'
    }
    if (address.state.trim() && !isValidUf(address.state)) found.state = 'UF inválida.'
    return found
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    if (busy || photoBusy) return
    const found = validate()
    setErrors(found)
    setFormError('')

    if (focusFirst(form, found)) return

    setBusy(true)
    try {
      onAccountChange(await updateAccount(changes()))
      setSaved(true)
    } catch (failure) {
      const byField = failure instanceof ApiError ? (failure.fields as Errors) : {}
      if (Object.keys(byField).length > 0) {
        setErrors(byField)
        focusFirst(form, byField)
      } else {
        setFormError(errorMessage(failure))
      }
    } finally {
      setBusy(false)
    }
  }

  // Leva o foco ao primeiro campo com problema; devolve se havia algum
  function focusFirst(form: HTMLFormElement, found: Errors) {
    const first = Object.keys(found)[0]
    if (!first) return false
    const element = form.elements.namedItem(first)
    if (element instanceof HTMLElement) element.focus()
    return true
  }

  function changes() {
    return {
      name: name.trim().replace(/\s+/g, ' '),
      phone: phone.replace(/\D/g, ''),
      address: {
        cep: cepDigits,
        street: address.street.trim(),
        number: address.number.trim(),
        complement: address.complement.trim(),
        neighborhood: address.neighborhood.trim(),
        city: address.city.trim(),
        state: address.state.trim().toUpperCase(),
      },
    }
  }

  return (
    <form
      className="page-section form"
      onSubmit={handleSubmit}
      onChange={() => setSaved(false)}
      noValidate
    >
      <h1 className="page-title">Seu perfil</h1>

      {account.isAdmin && (
        <a className="primary admin-link" href={routes.admin}>
          Abrir administração do portal
        </a>
      )}

      <div className={`photo-field${errors.photo ? ' is-invalid' : ''}`}>
        <Avatar name={name || account.name} photo={photo} large />
        <button
          type="button"
          className="clear-filters"
          name="photo"
          aria-describedby={errors.photo ? 'photo-erro' : 'photo-ajuda'}
          onClick={() => fileRef.current?.click()}
        >
          {photoBusy ? 'Enviando foto…' : photo ? 'Trocar foto' : 'Adicionar foto'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={PHOTO_TYPES.join(',')}
          aria-label="Foto do perfil"
          hidden
          onChange={(e) => {
            choosePhoto(e.target.files?.[0])
            // Permite escolher o mesmo arquivo de novo depois de um erro
            e.target.value = ''
          }}
        />
        {errors.photo ? (
          errorNote('photo')
        ) : (
          <small id="photo-ajuda" className="field-help">
            {isProvider
              ? 'Obrigatória para quem oferece serviços. Uma foto do rosto passa mais confiança.'
              : 'Opcional.'}
          </small>
        )}
      </div>

      <label className="field">
        <span>Nome</span>
        <input
          {...invalidProps('name')}
          required
          maxLength={60}
          autoComplete="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            clearError('name')
          }}
        />
        {errorNote('name')}
      </label>

      <label className="field">
        <span>WhatsApp</span>
        <input
          {...invalidProps('phone', 'whatsapp-ajuda')}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(62) 99999-9999"
          value={phone}
          onChange={(e) => {
            setPhone(formatPhone(e.target.value))
            clearError('phone')
          }}
        />
        {errorNote('phone') ?? (
          <small id="whatsapp-ajuda" className="field-help">
            Quem contratar seus serviços vai falar com você por este número.
          </small>
        )}
      </label>

      <fieldset className="address">
        <legend>Endereço</legend>

        <div className="address-row">
          <label className="field">
            <span>CEP</span>
            <input
              {...invalidProps('cep', 'cep-ajuda')}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              value={address.cep}
              onChange={(e) => {
                changeCep(e.target.value)
                clearError('cep')
              }}
            />
          </label>
          <label className="field">
            <span>Número</span>
            <input
              ref={numberRef}
              maxLength={20}
              value={address.number}
              onChange={(e) => setField('number', e.target.value)}
            />
          </label>
        </div>
        {errorNote('cep') ?? (
          <small
            id="cep-ajuda"
            className={cepStatus === 'not-found' ? 'form-error' : 'field-help'}
            aria-live="polite"
          >
            {cepStatus === 'loading' && 'Buscando o endereço…'}
            {cepStatus === 'not-found' &&
              'Não encontramos esse CEP. Confira os números ou preencha o endereço abaixo.'}
            {(cepStatus === 'idle' || cepStatus === 'found') &&
              'Só o bairro aparece para outras pessoas.'}
          </small>
        )}

        <label className="field">
          <span>Rua</span>
          <input
            maxLength={80}
            autoComplete="address-line1"
            value={address.street}
            onChange={(e) => setField('street', e.target.value)}
          />
        </label>

        <label className="field">
          <span>Complemento (opcional)</span>
          <input
            maxLength={60}
            autoComplete="address-line2"
            placeholder="Apto, bloco, quadra, lote"
            value={address.complement}
            onChange={(e) => setField('complement', e.target.value)}
          />
        </label>

        <label className="field">
          <span>Bairro</span>
          <input
            maxLength={50}
            value={address.neighborhood}
            onChange={(e) => setField('neighborhood', e.target.value)}
          />
        </label>

        <div className="address-row address-row-city">
          <label className="field">
            <span>Cidade</span>
            <input
              {...invalidProps('city')}
              maxLength={50}
              autoComplete="address-level2"
              value={address.city}
              onChange={(e) => {
                setField('city', e.target.value)
                clearError('city')
              }}
            />
            {errorNote('city')}
          </label>
          <label className="field">
            <span>UF</span>
            <input
              {...invalidProps('state')}
              maxLength={2}
              autoComplete="address-level1"
              value={address.state}
              onChange={(e) => {
                // Só letras, sempre em maiúsculas
                setField('state', e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())
                clearError('state')
              }}
            />
            {errorNote('state')}
          </label>
        </div>
      </fieldset>

      <div aria-live="polite">
        {formError && <p className="form-error">{formError}</p>}
        {saved && (
          <p className="form-ready">
            Perfil salvo.
          </p>
        )}
      </div>
      <div className="form-actions">
        <button type="button" className="clear-filters" onClick={onLogout}>
          Sair
        </button>
        <button type="submit" className="primary" disabled={busy || photoBusy}>
          {busy ? 'Salvando…' : 'Salvar perfil'}
        </button>
      </div>
    </form>
  )
}
