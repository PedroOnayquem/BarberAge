const errorMap: Record<string, string> = {
  'Invalid login credentials': 'Email ou senha incorretos',
  'Email not confirmed': 'Email ainda não confirmado. Verifique sua caixa de entrada.',
  'User already registered': 'Este email já está cadastrado',
  'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
  'Signup requires a valid password': 'Informe uma senha válida',
  'Unable to validate email address: invalid format': 'Formato de email inválido',
  'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'For security purposes, you can only request this after': 'Por segurança, aguarde antes de tentar novamente.',
  'New password should be different from the old password': 'A nova senha deve ser diferente da anterior',
  'Auth session missing!': 'Sessão expirada. Faça login novamente.',
  'Email address cannot be used as it is not authorized': 'Este endereço de email não é permitido.',
}

export function translateError(message: string): string {
  for (const [key, value] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value
    }
  }

  if (message.includes('email_address_invalid') || message.includes('is invalid')) {
    return 'Endereço de email inválido'
  }

  if (message.includes('over_email_send_rate_limit')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  }

  return message
}
