package errcode

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestWrapAndUnwrap(t *testing.T) {
	cases := []struct {
		e         error
		expectErr string
	}{
		{e: ErrCustom, expectErr: "rpc error: code = Code(7000) desc = 自定义错误"},
		{e: ErrUnexpected, expectErr: "rpc error: code = Code(7777) desc = 服务器繁忙，请稍后重试"},
		{e: errors.New("测试错误"), expectErr: "rpc error: code = Unknown desc = 测试错误"},
		{e: ErrTokenExpire, expectErr: "rpc error: code = Code(10004) desc = token过期"},
		{e: nil, expectErr: "<nil>"},
		{e: WrapErr(ErrCustom), expectErr: "rpc error: code = Code(7000) desc = 自定义错误"},
		{e: WrapErr(NewErr(7000, "test 7000 code")), expectErr: "rpc error: code = Code(7000) desc = test 7000 code"},
	}

	for _, c := range cases {
		got := WrapErr(c.e)
		t.Log(got)
		if got != nil {
			assert.Equal(t, c.expectErr, got.Error())
		}
		t.Log(UnwrapErr(got))
	}
}
