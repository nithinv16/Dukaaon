import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dukaaon.in';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/_next/',
          '/enquiry-demo/',
          '/components-demo/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
