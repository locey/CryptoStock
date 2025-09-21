package xhttp

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

type getBalanceParam struct {
	Addresses []string `json:"addresses"`
	Execer    string   `json:"execer"`
}

type getBalanceResult struct {
	Currency int    `json:"currency"`
	Balance  int64  `json:"balance"`
	Frozen   int64  `json:"frozen"`
	Addr     string `json:"addr"`
}

func TestNewRPCClient(t *testing.T) {
	c := NewRPCClient("http://127.0.0.1:8801")
	assert.NotNil(t, c)
}

func TestNewRPCClientWithOptions(t *testing.T) {
	c := NewRPCClient("http://127.0.0.1:8801",
		WithHTTPClient(nil), WithCustomHeaders(nil))
	assert.NotNil(t, c)
}

func TestNewRPCRequest(t *testing.T) {
	req := NewRPCRequest("Chain33.GetBalance", &getBalanceParam{
		Addresses: []string{"133AfuMYQXRxc45JGUb1jLk1M1W4ka39L1"},
		Execer:    "coins",
	})
	b, err := json.Marshal(req)
	assert.NoError(t, err)
	assert.Equal(t, "{\"jsonrpc\":\"2.0\",\"id\":0,\"method\":\"Chain33.GetBalance\",\"params\":[{\"addresses\":[\"133AfuMYQXRxc45JGUb1jLk1M1W4ka39L1\"],\"execer\":\"coins\"}]}", string(b))
}

func TestRPCClient_Call(t *testing.T) {
	c := NewRPCClient("http://127.0.0.1:8801")
	resp, err := c.Call("Chain33.GetBalance", &getBalanceParam{
		Addresses: []string{"133AfuMYQXRxc45JGUb1jLk1M1W4ka39L1"},
		Execer:    "coins",
	})
	assert.NoError(t, err)
	t.Logf("%+v", resp)
	assert.Nil(t, resp.Error)

	var results []*getBalanceResult
	err = resp.ReadToObject(&results)
	assert.NoError(t, err)
	for _, result := range results {
		t.Logf("%+v", result)
	}
}

func TestRpcClient_CallRaw(t *testing.T) {
	c := NewRPCClient("http://127.0.0.1:8801")
	resp, err := c.CallRaw(&RPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "Chain33.GetBalance",
		Params: []*getBalanceParam{
			{
				Addresses: []string{"133AfuMYQXRxc45JGUb1jLk1M1W4ka39L1"},
				Execer:    "coins",
			},
		},
	})
	assert.NoError(t, err)
	t.Logf("%+v", resp)
	assert.Nil(t, resp.Error)

	var results []*getBalanceResult
	err = resp.ReadToObject(&results)
	assert.NoError(t, err)
	for _, result := range results {
		t.Logf("%+v", result)
	}
}

func TestRpcClient_CallFor(t *testing.T) {
	c := NewRPCClient("http://127.0.0.1:8801")
	var results []*getBalanceResult
	err := c.CallFor(&results, "Chain33.GetBalance", &getBalanceParam{
		Addresses: []string{"133AfuMYQXRxc45JGUb1jLk1M1W4ka39L1"},
		Execer:    "coins",
	})
	assert.NoError(t, err)
	for _, result := range results {
		t.Logf("%+v", result)
	}
}
