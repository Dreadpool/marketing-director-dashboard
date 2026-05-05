import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let _transporter: Transporter | null = null;

/**
 * HubSpot SMTP API transport.
 * - Host: smtp.hubapi.com (na1) or smtp-eu1.hubapi.com (eu1). SLE is na1.
 * - Port 587 with STARTTLS (`secure: false` triggers STARTTLS via the `requireTLS` flag).
 * - Auth uses the username/password pair issued when an SMTP API token is created.
 */
export function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  const user = process.env.HUBSPOT_SMTP_USER;
  const pass = process.env.HUBSPOT_SMTP_PASSWORD;
  if (!user || !pass) {
    throw new Error("HUBSPOT_SMTP_USER and HUBSPOT_SMTP_PASSWORD must be set");
  }

  _transporter = nodemailer.createTransport({
    host: process.env.HUBSPOT_SMTP_HOST ?? "smtp.hubapi.com",
    port: Number(process.env.HUBSPOT_SMTP_PORT ?? 587),
    secure: false,
    requireTLS: true,
    auth: { user, pass },
  });

  return _transporter;
}

export const FROM_INTERVIEWS =
  process.env.SMTP_FROM_INTERVIEWS ?? "Brady Price <brady.price@saltlakeexpress.com>";

export const RESERVATIONS_EMAIL =
  process.env.RESERVATIONS_EMAIL ?? "reservations@saltlakeexpress.com";
