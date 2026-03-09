import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import Image from 'next/image'

import icon from './icon.png'

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        <Image src={icon} alt="Agent Messenger" width={24} height={24} />
        Agent Messenger
      </>
    ),
  },
}
