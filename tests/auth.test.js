// tests/auth.test.js
//
// Basic automated tests for the authentication flow. Run with: npm test
//
// PREREQUISITE: these tests hit a REAL MySQL database (the same one
// configured in your .env), since this project intentionally has no
// mocking layer for beginner-readability. Run schema.sql + seed.sql
// first, and make sure the server's .env DB settings are correct.
// Each test run registers a unique random email so it can be re-run
// without manual cleanup.

const request = require('supertest');
const app = require('../src/app');

const uniqueEmail = `test.${Date.now()}@example.com`;
const password = 'Password@123';

describe('Auth: Registration', () => {
  it('registers a new citizen successfully', async () => {
    const res = await request(app).post('/api/auth/register').send({
      full_name: 'Automated Test User',
      email: uniqueEmail,
      phone: '9999900099',
      password,
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(uniqueEmail);
    expect(res.body.data.user.role).toBe('citizen');
    expect(res.body.data.token).toBeDefined();
    // Password hash must never be returned to the client.
    expect(res.body.data.user.password_hash).toBeUndefined();
  });

  it('rejects registration with a duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      full_name: 'Duplicate User',
      email: uniqueEmail, // same as above — already registered
      phone: '9999900099',
      password,
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects registration with a weak password', async () => {
    const res = await request(app).post('/api/auth/register').send({
      full_name: 'Weak Password User',
      email: `weak.${Date.now()}@example.com`,
      password: '12345',
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('Auth: Login', () => {
  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: uniqueEmail,
      password,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: uniqueEmail,
      password: 'WrongPassword@123',
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects login for a non-existent email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password,
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('Auth: Protected routes', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: uniqueEmail, password });
    token = res.body.data.token;
  });

  it('rejects /auth/me with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('accepts /auth/me with a valid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.user.email).toBe(uniqueEmail);
  });

  it('rejects a citizen from an admin-only route', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(403);
  });
});
