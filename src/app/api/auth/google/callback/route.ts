import { NextRequest } from "next/server";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return new Response("Kod bulunamadı", { status: 400 });
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const { tokens } = await client.getToken(code);

  const html = `
    <html>
    <head><meta charset="utf-8"><title>Google Calendar Bağlantısı</title></head>
    <body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px">
      <h2>Google Calendar Bağlantısı Başarılı!</h2>
      <p>Aşağıdaki <strong>refresh_token</strong> değerini Railway environment variables'a <code>GOOGLE_REFRESH_TOKEN</code> olarak ekleyin:</p>
      <textarea readonly style="width:100%;height:80px;font-size:14px;padding:8px">${tokens.refresh_token || "REFRESH TOKEN ALINAMADI - prompt=consent ile tekrar deneyin"}</textarea>
      <p style="color:#666;margin-top:16px">Bu sayfayı kaydettikten sonra kapatabilirsiniz.</p>
    </body>
    </html>
  `;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
