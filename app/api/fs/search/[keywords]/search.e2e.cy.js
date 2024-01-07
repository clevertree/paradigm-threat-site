/// <reference types="cypress" />

describe('test API routes', () => {
  context('POST /api/fs/search/deep%20pyramid', () => {
    it('create a posts in development chat', () => {
      cy.request('GET', '/api/fs/search/gate%20pyramid').then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.pages.length).to.be.greaterThan(2)
        expect(response.body.files.length).to.be.greaterThan(2)
        // expect(response.body.post).to.be.eq(15)
      })
    })
  })
})
