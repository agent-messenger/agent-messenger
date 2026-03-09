import { DocsBody, DocsPage } from 'fumadocs-ui/layouts/docs/page'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { source } from '@/lib/source'

interface PageProps {
  params: Promise<{
    slug?: string[]
  }>
}

export async function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params
  const page = source.getPage(params.slug)

  if (!page) {
    return {}
  }

  return {
    title: page.data.title,
    description: page.data.description,
  }
}

export default async function Page(props: PageProps) {
  const params = await props.params
  const page = source.getPage(params.slug)

  if (!page) {
    notFound()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { body: MDX, toc } = page.data as any

  return (
    <DocsPage toc={toc}>
      <h1 className="mb-2 text-3xl font-bold">{page.data.title}</h1>
      {page.data.description && <p className="text-muted-foreground mb-6 text-lg">{page.data.description}</p>}
      <DocsBody>
        <MDX />
      </DocsBody>
    </DocsPage>
  )
}
