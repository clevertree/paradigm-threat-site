'use client'

import Image from 'next/image'

export default function ClientImage ({ alt, ...props }) {
  let srcProps = props
  if (typeof props?.src?.default === 'object') { srcProps = { ...props, ...props.src.default } } else if (typeof props.src === 'object') { srcProps = { ...props, ...props.src } } else if (typeof props.default === 'object') { srcProps = { ...props, ...props.default } }

  return <Image {...srcProps} alt={alt} />
}
