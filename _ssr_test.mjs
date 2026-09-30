import { renderToString } from 'react-dom/server'
import React from 'react'
import { Toast } from '@heroui/react'
import { SkinProvider } from './src/store/skinStore.jsx'
import { InspectProvider } from './src/hooks/useInspect.jsx'

const { default: StudioBody } = await import('./src/components/SkinStudio.jsx')
  .then((m) => ({ default: null }))
  .catch(() => ({ default: null }))

function Probe({ children }) {
  return children
}

// 1) Toast.Provider alone
try {
  const html = renderToString(
    React.createElement(
      Toast.Provider,
      { placement: 'bottom-end', maxVisibleToasts: 4 },
      React.createElement('div', null, 'child-inside-toast'),
    ),
  )
  console.log('Toast.Provider html:', JSON.stringify(html.slice(0, 300)))
} catch (e) {
  console.error('Toast.Provider fail', e)
}

// 2) plain provider
console.log('plain', renderToString(React.createElement('div', null, 'x')))
