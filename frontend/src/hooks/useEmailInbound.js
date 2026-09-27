import { useState } from 'react';
import { apiRequest } from '../api/client';

/**
 * Simulates an email arriving at the GoldenCare inbox.
 * Two ways in: a composed email (multipart webhook) or a raw .eml file.
 * @returns {{isSending: boolean, response: object|null, error: string|null,
 *   sendComposedEmail: Function, sendEmlFile: Function, reset: Function}}
 */
export function useEmailInbound() {
  const [isSending, setIsSending] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const send = async (path, body) => {
    setIsSending(true);
    setError(null);
    setResponse(null);
    try {
      const data = await apiRequest(path, { method: 'POST', body });
      setResponse(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsSending(false);
    }
  };

  /**
   * @param {{from: string, to: string, subject: string, text: string, files: File[]}} email
   */
  const sendComposedEmail = (email) => {
    const form = new FormData();
    form.append('from', email.from);
    form.append('to', email.to);
    form.append('subject', email.subject);
    form.append('text', email.text);
    form.append('headers', 'X-Mailer: GoldenCare Backoffice Simulator\nX-Priority: 3');
    email.files.forEach((file) => form.append('attachments', file));
    return send('/api/email/inbound', form);
  };

  /** @param {File} file - a raw RFC 822 message (.eml) */
  const sendEmlFile = (file) => {
    const form = new FormData();
    form.append('file', file);
    return send('/api/email/inbound/eml', form);
  };

  const reset = () => {
    setResponse(null);
    setError(null);
  };

  return { isSending, response, error, sendComposedEmail, sendEmlFile, reset };
}
