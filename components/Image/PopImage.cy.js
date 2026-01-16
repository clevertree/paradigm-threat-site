import React from 'react'
import PopImage from './PopImage'
import { ImageGalleryProvider } from './ImageGalleryContext'

describe('<PopImage />', () => {
  it('renders', () => {
    // see: https://on.cypress.io/mounting-react
    cy.mount(
      <ImageGalleryProvider>
        <PopImage src='/favicon.ico' />
      </ImageGalleryProvider>
    )
  })
})
