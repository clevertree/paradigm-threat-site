describe('Dynamic Site Specification', () => {
    it('visits the homepage', () => {
        cy.visit('/', { failOnStatusCode: false });
        cy.contains('Welcome to Paradigm Threat', { timeout: 10000 });
    });
    
    it('visits a subpage', () => {
        cy.visit('/history/mudflood', { failOnStatusCode: false });
        cy.contains('MudFlood', { timeout: 10000 });
    });
});
