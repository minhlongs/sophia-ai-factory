import { MetadataRoute } from 'next'
import { PRODUCTS } from '@/lib/data/products'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://84tea.com'

  // Static pages
  const staticPages = [
    '',
    '/products',
    '/about',
    '/franchise',
    '/franchise/apply',
    '/contact',
    '/training',
    '/ops',
  ].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1.0 : 0.8,
  }))

  // Product pages
  const productPages = PRODUCTS.map(product => ({
    url: `${baseUrl}/products/${product.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...productPages]
}
