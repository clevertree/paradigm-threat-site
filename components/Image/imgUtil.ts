interface ImagePropsFormatted {
    src: string,
}

export function processImageProps(props: any): ImagePropsFormatted {
    if (typeof props.src === 'object') {
        const {src, ...otherProps} = props
        const newProps = {...src, ...otherProps}
        return processImageProps(newProps)
    }
    if (typeof props.default === 'object') {
        const {default: src, ...otherProps} = props
        const newProps = {...src, ...otherProps}
        return processImageProps(newProps)
    }
    if (typeof props.src === "string") {
        return props as ImagePropsFormatted
    }
    throw new Error('Invalid src string' + JSON.stringify(props))
}

// const imageSizes = [16, 32, 48, 64, 96, 128, 256, 384]

// export function getResizedThumbnail ({ src, width, quality = 75 }) {
//   if (process.env.NEXT_PUBLIC_OPTIMIZE_IMAGES !== 'true') { return src }
//   for (const imageSize of imageSizes) {
//     if (width <= imageSize) {
//       return `/_next/image?url=${encodeURIComponent(src)}&w=${imageSize}&q=${quality}`
//     }
//   }
//   return src
// }
