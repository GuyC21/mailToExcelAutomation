import { useState } from 'react';
import { apiRequest } from '../api/client';

/**
 * Hook: useEmailInbound
 * 
 * Handles the simulation of incoming emails for the GoldenCare backoffice.
 * This abstracts away the complexity of building multipart form data for 
 * either manually composed emails or raw .eml files. By keeping this here,
 * the Sandbox UI components only need to deal with the presentation of results.
 * 
 * @returns {{
 *   isSending: boolean,     // True while the email payload is being sent and processed
 *   response: object|null,  // The parsed email and extraction results returned by the server
 *   error: string|null,     // Error message if the operation fails
 *   sendComposedEmail: (email: {from: string, to: string, subject: string, text: string, files: File[]}) => Promise<object|null>, 
 *   sendEmlFile: (file: File) => Promise<object|null>, // Sends a raw RFC 822 .eml file
 *   reset: () => void       // Clears the current response and error state
 * }}
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
