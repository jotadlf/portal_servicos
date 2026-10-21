import { useRef, useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { BottomMenu } from '../components/BottomMenu'
import { LoginBar } from '../components/LoginBar'
import { updateAccount, type Account, type Address } from '../features/conta/usuario'
import { fetchAddress, formatCep } from '../lib/cep'
import { formatPhone, isValidPhone } from '../lib/whatsapp'

type ContaProps = {
  account?: Account
  onLogin: () => void
  onLogout: () => void
}

export function Conta({ account, onLogin, onLogout }: ContaProps) {
  return (
    <div className="app">
      <main className="page">
        {account ? (
          <PerfilForm key={account.id} account={account} onLogout={onLogout} />
        ) : (
          <div className="page-section">
            <h1 className="page-title">Seu perfil</h1>
            <LoginBar message="Entre para ver seu perfil." onLogin={onLogin} />
          </div>
        )}
      </main>

      <BottomMenu current="conta" />
    </div>
  )
}

type CepStatus = 'idle' | 'loading' | 'found' | 'not-found'

function PerfilForm({ account, onLogout }: { account: Account; onLogout: () => void }) {
  const [name, setName] = useState(account.name)
  const [photo, setPhoto] = useState(account.photo)
  const [phone, setPhone] = useState(formatPhone(account.phone))
  const [phoneError, setPhoneError] = useState('')
  const [address, setAddress] = useState<Address>({
    ...account.address,
    cep: formatCep(account.address.cep),
  })
  const [cepStatus, setCepStatus] = useState<CepStatus>('idle')
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const numberRef = useRef<HTMLInputElement>(null)

  // Só a última consulta de CEP vale, se a pessoa digitar outro antes da resposta
  const lastCepRef = useRef('')
  const cepDigits = address.cep.replace(/\D/g, '')

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
      setCepStatus('found')
      numberRef.current?.focus()
    })
  }

  function setField(field: keyof Address, value: string) {
    setAddress((current) => ({ ...current, [field]: value }))
  }

  function choosePhoto(file: File | undefined) {
    if (!file) return
    // TODO: enviar para o Supabase Storage. No protótipo a foto fica só nesta sessão.
    setPhoto(URL.createObjectURL(file))
    setSaved(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const digits = phone.replace(/\D/g, '')

    if (digits && !isValidPhone(digits)) {
      setPhoneError('Informe o WhatsApp com DDD, por exemplo (62) 99999-9999.')
      return
    }

    updateAccount(account.id, {
      name: name.trim(),
      phone: digits,
      photo,
      address: {
        cep: cepDigits,
        street: address.street.trim(),
        number: address.number.trim(),
        complement: address.complement.trim(),
        neighborhood: address.neighborhood.trim(),
        city: address.city.trim(),
        state: address.state.trim().toUpperCase(),
      },
    })
    setSaved(true)
  }

  return (
    <form className="page-section form" onSubmit={handleSubmit} onChange={() => setSaved(false)}>
      <h1 className="page-title">Seu perfil</h1>

      <div className="photo-field">
        <Avatar name={name || account.name} photo={photo} large />
        <button type="button" className="clear-filters" onClick={() => fileRef.current?.click()}>
          {photo ? 'Trocar foto' : 'Adicionar foto'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => choosePhoto(e.target.files?.[0])}
        />
      </div>

      <label className="field">
        <span>Nome</span>
        <input
          required
          maxLength={60}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="field">
        <span>WhatsApp</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(62) 99999-9999"
          aria-invalid={phoneError ? true : undefined}
          aria-describedby="whatsapp-ajuda"
          value={phone}
          onChange={(e) => {
            setPhone(formatPhone(e.target.value))
            setPhoneError('')
          }}
        />
        <small id="whatsapp-ajuda" className={phoneError ? 'form-error' : 'field-help'}>
          {phoneError || 'Quem contratar seus serviços vai falar com você por este número.'}
        </small>
      </label>

      <fieldset className="address">
        <legend>Endereço</legend>

        <div className="address-row">
          <label className="field">
            <span>CEP</span>
            <input
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              aria-describedby="cep-ajuda"
              value={address.cep}
              onChange={(e) => changeCep(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Número</span>
            <input
              ref={numberRef}
              maxLength={10}
              value={address.number}
              onChange={(e) => setField('number', e.target.value)}
            />
          </label>
        </div>
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
              maxLength={50}
              autoComplete="address-level2"
              value={address.city}
              onChange={(e) => setField('city', e.target.value)}
            />
          </label>
          <label className="field">
            <span>UF</span>
            <input
              maxLength={2}
              autoComplete="address-level1"
              value={address.state}
              onChange={(e) => setField('state', e.target.value)}
            />
          </label>
        </div>
      </fieldset>

      <div aria-live="polite">
        {saved && (
          <p className="form-ready">
            Alterações salvas nesta sessão. A gravação no servidor ainda não está disponível.
          </p>
        )}
      </div>
      <div className="form-actions">
        <button type="button" className="clear-filters" onClick={onLogout}>
          Sair
        </button>
        <button type="submit" className="primary">
          Salvar perfil
        </button>
      </div>
    </form>
  )
}
