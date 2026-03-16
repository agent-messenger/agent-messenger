# Agent Messenger Documentation Website

A modern documentation site for Agent Messenger built with [Next.js](https://nextjs.org), [Fumadocs](https://fumadocs.vercel.app/), and [Tailwind CSS](https://tailwindcss.com/).

## Quick Start

### Prerequisites

- Node.js 18+ or Bun
- Bun package manager (recommended)

### Installation

```bash
# Install dependencies
bun install
```

### Development

```bash
# Start the development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the documentation site.

The site includes:

- **Landing page** with hero section, features, and quick start guide
- **Documentation pages** with sidebar navigation
- **Search functionality** for finding documentation
- **Dark/light theme toggle** for user preference
- **Mobile responsive design** for all devices
- **SEO optimized** with meta tags and structured data

### Building

```bash
# Build for production
bun run build

# Preview production build
bun run start
```

### Code Quality

```bash
# Run linting and formatting checks
bun run lint

# Format code automatically
bun run format
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Landing page
│   ├── layout.tsx            # Root layout with theme provider
│   ├── layout.config.tsx     # Navigation configuration
│   ├── globals.css           # Global styles
│   └── docs/
│       ├── layout.tsx        # Docs layout with sidebar
│       └── [[...slug]]/
│           └── page.tsx      # Dynamic documentation pages
├── lib/
│   └── source.ts            # Fumadocs source configuration
└── content/
    └── docs/                # MDX documentation files
```

## Documentation

Documentation pages are written in MDX format and located in `src/content/docs/`. Each page includes:

- Front matter with title, description, and optional icon
- Markdown content with syntax highlighting
- Automatic table of contents generation

### Adding New Documentation

1. Create a new `.mdx` file in `src/content/docs/`
2. Add front matter with title and description
3. Write your content in Markdown
4. The page will automatically appear in the sidebar navigation

## Technologies

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Documentation**: [Fumadocs](https://fumadocs.vercel.app/) for MDX support and search
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with dark mode support
- **Fonts**: [Geist](https://vercel.com/font) font family
- **Linting**: [oxlint](https://oxc.rs/docs/guide/usage/linter) + [oxfmt](https://oxc.rs/docs/guide/usage/formatter) for code quality
- **Package Manager**: [Bun](https://bun.sh/)

## Features

- ✨ **Modern Design** - Clean, professional landing page with hero section
- 🌙 **Dark Mode** - Built-in theme toggle with system preference detection
- 🔍 **Search** - Full-text search across all documentation pages
- 📱 **Responsive** - Mobile-first design that works on all devices
- ♿ **Accessible** - WCAG compliant with proper ARIA labels
- 🚀 **Fast** - Static site generation for optimal performance
- 📊 **SEO** - Optimized meta tags and structured data

## Resources

- [Fumadocs Documentation](https://fumadocs.vercel.app/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [MDX Documentation](https://mdxjs.com/)
