import smtplib
from email.message import EmailMessage
from core.config import get_settings

settings = get_settings()


def _build_html(title: str, intro: str, code: str, note: str = "") -> str:
    """Create a simple OTP email template."""
    note_html = f"<p style='color:#666;font-size:13px;margin-top:16px;'>{note}</p>" if note else ""
    return f"""<!DOCTYPE html>
<html>
  <body style=\"margin:0; padding:0; background:#f4f6f8; font-family:Arial, sans-serif;\">
    <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"padding:40px 0;\">
      <tr>
        <td align=\"center\">
          <table width=\"420\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#ffffff; border-radius:8px; padding:30px;\">
            <tr>
              <td align=\"center\" style=\"padding-bottom:20px;\">
                <h2 style=\"margin:0; color:#222;\">{title}</h2>
              </td>
            </tr>
            <tr>
              <td style=\"text-align:center; color:#555; font-size:14px; padding-bottom:10px;\">{intro}</td>
            </tr>
            <tr>
              <td align=\"center\" style=\"padding:10px 0 20px 0;\">
                <div style=\"display:inline-block; font-size:28px; letter-spacing:6px; font-weight:700; color:#111; background:#f1f3f5; padding:12px 20px; border-radius:8px;\">{code}</div>
              </td>
            </tr>
            <tr>
              <td style=\"text-align:center; color:#666; font-size:13px;\">Enter this code in Mentora.</td>
            </tr>
            <tr>
              <td align=\"center\">{note_html}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def send_auth_email(to_email: str, subject: str, title: str, intro: str, code: str, note: str = "") -> None:
    """Send OTP email via SMTP. Raises on SMTP errors."""
    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        # Intentionally fail loudly in prod and optionally expose OTP via API debug flag.
        raise RuntimeError("SMTP is not configured")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email

    plain = f"{title}\n\n{intro}\n\nCode: {code}\n\n{note}".strip()
    message.set_content(plain)
    message.add_alternative(_build_html(title=title, intro=intro, code=code, note=note), subtype="html")

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(message)
