import { MessageCircle, Phone } from 'lucide-react';

function contactPhone() {
  return process.env.NEXT_PUBLIC_ZALO_CONTACT_PHONE || process.env.ZALO_CONTACT_PHONE || '0398401104';
}

export function AdminContactBubble() {
  const phone = contactPhone();
  const cleanPhone = phone.replace(/\D/g, '') || '0398401104';

  return (
    <a
      className="contact-bubble"
      href={`https://zalo.me/${cleanPhone}`}
      target="_blank"
      rel="noreferrer"
      aria-label={`Liên hệ admin qua Zalo ${phone}`}
    >
      <span className="contact-bubble-icon">
        <MessageCircle size={20} />
      </span>
      <span className="contact-bubble-copy">
        <strong>Liên hệ admin</strong>
        <small><Phone size={13} /> {phone}</small>
      </span>
    </a>
  );
}
