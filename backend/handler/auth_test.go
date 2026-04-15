package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/court-command/court-command/testutil"
)

func TestRegister(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "users")
	ts := testutil.TestServer(t, pool)

	body := map[string]string{
		"email":         "register@test.com",
		"password":      "password123",
		"first_name":    "Register",
		"last_name":     "Test",
		"date_of_birth": "1990-05-20",
	}
	b, _ := json.Marshal(body)

	resp, err := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("POST /auth/register: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if result["public_id"] == nil || result["public_id"] == "" {
		t.Error("expected public_id to be set")
	}
	if result["role"] != "player" {
		t.Errorf("expected role=player, got %v", result["role"])
	}
	if result["status"] != "active" {
		t.Errorf("expected status=active, got %v", result["status"])
	}

	cookies := resp.Cookies()
	found := false
	for _, c := range cookies {
		if c.Name == "cc_session" {
			found = true
			if c.Value == "" {
				t.Error("session cookie is empty")
			}
		}
	}
	if !found {
		t.Error("expected cc_session cookie to be set")
	}
}

func TestRegisterDuplicate(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "users")
	ts := testutil.TestServer(t, pool)

	body := map[string]string{
		"email":         "dup@test.com",
		"password":      "password123",
		"first_name":    "Dup",
		"last_name":     "Test",
		"date_of_birth": "1990-01-01",
	}
	b, _ := json.Marshal(body)

	resp1, _ := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(b))
	resp1.Body.Close()
	if resp1.StatusCode != http.StatusCreated {
		t.Fatalf("first register expected 201, got %d", resp1.StatusCode)
	}

	b, _ = json.Marshal(body)
	resp2, _ := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(b))
	resp2.Body.Close()
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("duplicate register expected 400, got %d", resp2.StatusCode)
	}
}

func TestRegisterValidation(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "users")
	ts := testutil.TestServer(t, pool)

	tests := []struct {
		name string
		body map[string]string
	}{
		{"missing email", map[string]string{"password": "password123", "first_name": "A", "last_name": "B", "date_of_birth": "1990-01-01"}},
		{"invalid email", map[string]string{"email": "bad", "password": "password123", "first_name": "A", "last_name": "B", "date_of_birth": "1990-01-01"}},
		{"short password", map[string]string{"email": "a@b.com", "password": "short", "first_name": "A", "last_name": "B", "date_of_birth": "1990-01-01"}},
		{"missing first_name", map[string]string{"email": "a@b.com", "password": "password123", "last_name": "B", "date_of_birth": "1990-01-01"}},
		{"missing last_name", map[string]string{"email": "a@b.com", "password": "password123", "first_name": "A", "date_of_birth": "1990-01-01"}},
		{"missing dob", map[string]string{"email": "a@b.com", "password": "password123", "first_name": "A", "last_name": "B"}},
		{"invalid dob", map[string]string{"email": "a@b.com", "password": "password123", "first_name": "A", "last_name": "B", "date_of_birth": "not-a-date"}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			b, _ := json.Marshal(tc.body)
			resp, _ := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(b))
			resp.Body.Close()
			if resp.StatusCode != http.StatusBadRequest {
				t.Errorf("expected 400, got %d", resp.StatusCode)
			}
		})
	}
}

func TestLoginAndMe(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "users")
	ts := testutil.TestServer(t, pool)

	// Register first
	regBody := map[string]string{
		"email":         "login@test.com",
		"password":      "password123",
		"first_name":    "Login",
		"last_name":     "Test",
		"date_of_birth": "1985-12-25",
	}
	b, _ := json.Marshal(regBody)
	regResp, _ := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(b))
	regResp.Body.Close()

	// Login
	loginBody := map[string]string{
		"email":    "login@test.com",
		"password": "password123",
	}
	b, _ = json.Marshal(loginBody)
	loginResp, err := http.Post(ts.URL+"/api/v1/auth/login", "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("login request failed: %v", err)
	}
	defer loginResp.Body.Close()

	if loginResp.StatusCode != http.StatusOK {
		t.Fatalf("login expected 200, got %d", loginResp.StatusCode)
	}

	var sessionCookie *http.Cookie
	for _, c := range loginResp.Cookies() {
		if c.Name == "cc_session" {
			sessionCookie = c
		}
	}
	if sessionCookie == nil {
		t.Fatal("expected session cookie after login")
	}

	// GET /me with the session cookie
	meReq, _ := http.NewRequest("GET", ts.URL+"/api/v1/auth/me", nil)
	meReq.AddCookie(sessionCookie)

	client := &http.Client{}
	meResp, err := client.Do(meReq)
	if err != nil {
		t.Fatalf("GET /auth/me: %v", err)
	}
	defer meResp.Body.Close()

	if meResp.StatusCode != http.StatusOK {
		t.Fatalf("/me expected 200, got %d", meResp.StatusCode)
	}

	var user map[string]interface{}
	json.NewDecoder(meResp.Body).Decode(&user)

	if user["email"] != "login@test.com" {
		t.Errorf("expected email=login@test.com, got %v", user["email"])
	}
	if user["first_name"] != "Login" {
		t.Errorf("expected first_name=Login, got %v", user["first_name"])
	}
}

func TestMeWithoutAuth(t *testing.T) {
	pool := testutil.TestDB(t)
	ts := testutil.TestServer(t, pool)

	resp, _ := http.Get(ts.URL + "/api/v1/auth/me")
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestLogout(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "users")
	ts := testutil.TestServer(t, pool)

	// Register to get a session
	regBody := map[string]string{
		"email":         "logout@test.com",
		"password":      "password123",
		"first_name":    "Logout",
		"last_name":     "Test",
		"date_of_birth": "1995-06-15",
	}
	b, _ := json.Marshal(regBody)
	regResp, _ := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(b))
	var sessionCookie *http.Cookie
	for _, c := range regResp.Cookies() {
		if c.Name == "cc_session" {
			sessionCookie = c
		}
	}
	regResp.Body.Close()

	// Logout
	logoutReq, _ := http.NewRequest("POST", ts.URL+"/api/v1/auth/logout", nil)
	logoutReq.AddCookie(sessionCookie)
	client := &http.Client{CheckRedirect: func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	}}
	logoutResp, _ := client.Do(logoutReq)
	logoutResp.Body.Close()

	if logoutResp.StatusCode != http.StatusNoContent {
		t.Fatalf("logout expected 204, got %d", logoutResp.StatusCode)
	}

	// Verify session is invalidated
	meReq, _ := http.NewRequest("GET", ts.URL+"/api/v1/auth/me", nil)
	meReq.AddCookie(sessionCookie)
	meResp, _ := client.Do(meReq)
	meResp.Body.Close()

	if meResp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("/me after logout expected 401, got %d", meResp.StatusCode)
	}
}

func TestLoginWrongPassword(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "users")
	ts := testutil.TestServer(t, pool)

	// Register
	regBody := map[string]string{
		"email":         "wrongpw@test.com",
		"password":      "password123",
		"first_name":    "Wrong",
		"last_name":     "Password",
		"date_of_birth": "1988-03-10",
	}
	b, _ := json.Marshal(regBody)
	regResp, _ := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(b))
	regResp.Body.Close()

	// Login with wrong password
	loginBody := map[string]string{
		"email":    "wrongpw@test.com",
		"password": "wrongpassword",
	}
	b, _ = json.Marshal(loginBody)
	loginResp, _ := http.Post(ts.URL+"/api/v1/auth/login", "application/json", bytes.NewReader(b))
	loginResp.Body.Close()

	if loginResp.StatusCode != http.StatusBadRequest {
		t.Fatalf("wrong password expected 400, got %d", loginResp.StatusCode)
	}
}

func TestHealthEndpoint(t *testing.T) {
	pool := testutil.TestDB(t)
	ts := testutil.TestServer(t, pool)

	resp, err := http.Get(ts.URL + "/api/v1/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if result["status"] != "ok" {
		t.Errorf("expected status=ok, got %v", result["status"])
	}
}
