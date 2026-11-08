import { useEffect, useRef } from 'react'
import { talkOnWhatsapp, type Professional } from '../features/profissionais/prestadores'
import { firstName } from '../lib/format'
import { WhatsappIcon } from './WhatsappIcon'

export type WhatsappTarget = {
  pro: Pick<Professional, 'id' | 'name' | 'whatsapp'>
  task?: string
}

type WhatsappConfirmProps = {
  target: WhatsappTarget
  onClose: () => void
  // Contato gravado no banco (só depois de tocar em "Abrir conversa")
  onContacted?: () => void
}

// Confirmação antes de sair para o WhatsApp. O contato só conta quando a pessoa confirma:
// um toque sem querer no botão não aparece para o prestador.
export function WhatsappConfirm({ target, onClose, onContacted }: WhatsappConfirmProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const name = firstName(target.pro.name)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  function openChat() {
    // Ainda no toque: o navegador bloqueia a janela aberta depois de esperar a rede
    talkOnWhatsapp(target.pro, target.task).then((saved) => saved && onContacted?.())
    dialogRef.current?.close()
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="whatsapp-confirm-title"
      aria-describedby="whatsapp-confirm-text"
      onClose={onClose}
      onClick={(event) => {
        // Tocar fora do cartão cancela
        if (event.target === event.currentTarget) dialogRef.current?.close()
      }}
    >
      <div className="confirm-body">
        <span className="confirm-icon" aria-hidden="true">
          <WhatsappIcon />
        </span>
        <h2 id="whatsapp-confirm-title">Falar com {name} no WhatsApp?</h2>
        <p id="whatsapp-confirm-text">
          {target.task
            ? `A conversa abre com uma mensagem pronta sobre "${target.task}".`
            : 'A conversa abre com uma mensagem pronta.'}{' '}
          {name} vai saber que você veio pelo portal.
        </p>
        <div className="confirm-actions">
          <button type="button" className="clear-filters" onClick={() => dialogRef.current?.close()}>
            Cancelar
          </button>
          <button type="button" className="primary" onClick={openChat} autoFocus>
            Abrir conversa
          </button>
        </div>
      </div>
    </dialog>
  )
}
