export class CookiesHandler {
    static getCookieValue(name: string): string | null {
        if (typeof document === 'undefined') return null; 

        const cookieString = document.cookie;
        const cookies = Object.fromEntries(
            cookieString.split('; ').map(cookie => {
                const [key, value] = cookie.split('=');
                return [key, decodeURIComponent(value)];
            })
        );

        return cookies[name] || null;
    }
}
