describe('test API routes', () => {
  context('GET /api/chat/channel/general/getPosts', () => {
    it('gets a list of posts in general chat', () => {
      cy.request('GET', '/api/chat/channel/general/getPosts').then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.channel).to.eq('general')
        expect(response.body.posts.length).to.be.eq(15)
      })
    })
  })
})
