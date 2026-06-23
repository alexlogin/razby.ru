import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkEmailCodeRateLimit,
  emailAuthSetupState,
  generateEmailCode,
  isAuthEmailAllowed,
  normalizeAuthEmail,
  sendEmailCode,
  storeEmailCode,
} from "@/lib/email-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Введите корректный email." }, { status: 400 });
  }

  const email = normalizeAuthEmail(parsed.data.email);
  const host = request.headers.get("host");
  const setup = emailAuthSetupState(host);

  if (!setup.enabled) {
    return NextResponse.json({ error: "Email-вход ещё не включён на сервере." }, { status: 503 });
  }

  if (!setup.allowlistReady) {
    return NextResponse.json({ error: "Для email-входа нужно задать RAZBY_AUTH_EMAILS." }, { status: 503 });
  }

  if (!setup.deliveryReady) {
    return NextResponse.json({ error: "Для email-входа нужно настроить Resend API key и отправителя." }, { status: 503 });
  }

  if (!checkEmailCodeRateLimit(email, request)) {
    return NextResponse.json({ error: "Слишком много попыток. Подождите минуту и попробуйте снова." }, { status: 429 });
  }

  if (!isAuthEmailAllowed(email, host)) {
    return NextResponse.json({ ok: true, message: "Если email разрешён, код придёт в течение минуты." });
  }

  const code = generateEmailCode();
  await storeEmailCode(email, code);

  let delivery: Awaited<ReturnType<typeof sendEmailCode>>;
  try {
    delivery = await sendEmailCode(email, code, host);
  } catch {
    return NextResponse.json({ error: "Почтовый провайдер не принял письмо. Проверьте EMAIL_FROM и API key." }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    message: "Если email разрешён, код придёт в течение минуты.",
    ...(delivery.mode === "dev" ? { devCode: delivery.code } : {}),
  });
}
