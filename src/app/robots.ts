import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lurumi.it'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: ['/', '/pricing', '/eventi', '/tools', '/guide', '/privacy', '/cookie-policy'],
                disallow: [
                    '/admin',
                    '/profilo',
                    '/dashboard',
                    '/projects/',
                    '/tutorials/',
                    '/api/',
                ],
            },
        ],
        sitemap: `${BASE_URL}/sitemap.xml`,
    }
}
