import React from 'react'
import PopImage from './PopImage'

describe('<PopImage />', () => {
  it('renders', () => {
    // see: https://on.cypress.io/mounting-react
    cy.mount(<PopImage />)
  })
})
