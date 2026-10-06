export const SAFETY_EN_MESSAGES = {
  "auth.error.verification": "Verify your email before signing in.",
  "safety.forgot": "Forgot password?",
  "safety.forgotDetail":
    "Enter your account email to request a secure password reset link.",
  "safety.reset": "Reset password",
  "safety.resetDetail": "Choose a new password of 8–128 characters.",
  "safety.verify": "Verify your email",
  "safety.verifyDetail":
    "Confirm ownership of your email address before signing in. Check your inbox and spam folder, or request another message.",
  "safety.sent": "Check your inbox",
  "safety.generic":
    "If this address is eligible, a message will arrive shortly. Check your spam folder too. You can request another message if needed.",
  "safety.request": "Request reset link",
  "safety.save": "Save new password",
  "safety.resend": "Resend verification email",
  "safety.sending": "Please wait…",
  "safety.newPassword": "New password",
  "safety.confirmPassword": "Confirm new password",
  "safety.resetDone": "Password changed",
  "safety.resetDoneDetail":
    "All sessions have ended. Sign in with your new password.",
  "safety.verified": "Email verified",
  "safety.verifiedDetail":
    "Sign in to continue. An Event invitation still requires your explicit acceptance.",
  "safety.verifyFailed": "Verification link unavailable",
  "safety.verifyFailedDetail":
    "This link is invalid or has expired. Request a new verification email.",
  "safety.back": "Back to sign in",
  "safety.limited":
    "Too many requests. Please wait 15 minutes before trying again.",
  "safety.invalid":
    "This reset link is invalid, expired or already used. Request a new link.",
  "safety.unavailable":
    "The request could not be completed. Please try again shortly.",
  "safety.mismatch": "The passwords do not match.",
  "safety.invitationSent":
    "Invitation email accepted for delivery. Inbox arrival is not guaranteed.",
  "safety.invitationFailed":
    "Email delivery failed. The invitation remains pending. Resend below; previous links will stop working.",
  "safety.resendInvitation": "Resend invitation",
} as const;
export const SAFETY_BG_MESSAGES = {
  "auth.error.verification": "Потвърдете имейла си преди вход.",
  "safety.forgot": "Забравена парола?",
  "safety.forgotDetail":
    "Въведете имейла на акаунта си, за да получите защитена връзка за нова парола.",
  "safety.reset": "Нова парола",
  "safety.resetDetail": "Изберете нова парола от 8 до 128 символа.",
  "safety.verify": "Потвърдете имейла си",
  "safety.verifyDetail":
    "Потвърдете, че имейлът е ваш, преди да влезете. Проверете входящата поща и спам папката или поискайте ново съобщение.",
  "safety.sent": "Проверете пощата си",
  "safety.generic":
    "Ако адресът отговаря на условията, скоро ще получите съобщение. Проверете и спам папката. При нужда поискайте ново съобщение.",
  "safety.request": "Поискайте връзка за нова парола",
  "safety.save": "Запазете новата парола",
  "safety.resend": "Изпратете потвърждението отново",
  "safety.sending": "Моля, изчакайте…",
  "safety.newPassword": "Нова парола",
  "safety.confirmPassword": "Повторете новата парола",
  "safety.resetDone": "Паролата е променена",
  "safety.resetDoneDetail":
    "Всички сесии са прекратени. Влезте с новата парола.",
  "safety.verified": "Имейлът е потвърден",
  "safety.verifiedDetail":
    "Влезте, за да продължите. Поканата за събитие все още изисква изрично приемане.",
  "safety.verifyFailed": "Невалидна връзка за потвърждение",
  "safety.verifyFailedDetail":
    "Връзката е невалидна или е изтекла. Поискайте нов имейл за потвърждение.",
  "safety.back": "Обратно към вход",
  "safety.limited":
    "Твърде много заявки. Изчакайте 15 минути и опитайте отново.",
  "safety.invalid":
    "Връзката е невалидна, изтекла или вече използвана. Поискайте нова връзка.",
  "safety.unavailable":
    "Заявката не можа да бъде завършена. Опитайте отново след малко.",
  "safety.mismatch": "Паролите не съвпадат.",
  "safety.invitationSent":
    "Имейлът с поканата е приет за доставка. Получаването в пощата не е гарантирано.",
  "safety.invitationFailed":
    "Имейлът не беше изпратен. Поканата остава чакаща. Изпратете я отново отдолу; старите връзки ще спрат да работят.",
  "safety.resendInvitation": "Изпратете поканата отново",
} satisfies Record<keyof typeof SAFETY_EN_MESSAGES, string>;
