export const CHAT_FULL_PREFIX = '/chat/full'

export function getChatBasePath(pathname: string | null): string {
    return pathname?.startsWith(CHAT_FULL_PREFIX) ? CHAT_FULL_PREFIX : '/chat'
}
