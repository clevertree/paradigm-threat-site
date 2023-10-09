import React from 'react'
import ChangeLog from './ChangeLog'

describe('<ChangeLog />', () => {
  it('renders', () => {
    // see: https://on.cypress.io/mounting-react
    cy.mount(<ChangeLog />)
  })
})