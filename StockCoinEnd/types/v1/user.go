package types

type LoginReq struct {
	ChainID   int    `json:"chain_id"`
	Message   string `json:"message"`
	Signature string `json:"signature"`
	Address   string `json:"address"`
}

type UserLoginInfo struct {
	Token     string `json:"token"`
	IsAllowed bool   `json:"is_allowed"`
}

type UserLoginResp struct {
	Result interface{} `json:"result"`
}

type UserLoginMsgResp struct {
	Address string `json:"address"`
	Message string `json:"message"`
}

type UserSignStatusResp struct {
	IsSigned bool `json:"is_signed"`
}
