import React from 'react'
import FileSearchForm from './FileSearchForm'

describe('<FileSearchForm />', () => {
  it('renders', () => {
    // see: https://on.cypress.io/mounting-react
    cy.mount(<FileSearchForm />)
  })
})