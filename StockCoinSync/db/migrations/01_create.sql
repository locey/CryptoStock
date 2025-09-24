
create table ob_user
(
    id          bigint auto_increment comment '主键'
        primary key,
    address     varchar(66)          not null comment '用户地址',
    is_allowed  tinyint(1) default 0 not null comment '是否允许用户访问',
    is_signed   tinyint(1) default 0 null,
    create_time bigint               null comment '创建时间',
    update_time bigint               null comment '更新时间',
    constraint index_address
        unique (address)
)
    collate = utf8mb4_general_ci;

create table ob_indexed_status
(
    id                 bigint auto_increment comment '主键'
        primary key,
    chain_id           bigint  default 1 not null comment '链id (1:以太坊, 56: BSC)',
    last_indexed_block bigint  default 0 null comment '区块号',
    last_indexed_time  bigint            null comment '最后同步时间戳',
    index_type         tinyint default 0 not null comment '0:stocktoken',
    create_time        bigint            null,
    update_time        bigint            null
)
    collate = utf8mb4_general_ci;
create table ob_activity_sepolia
(
    id                 bigint auto_increment comment '主键'
        primary key,
    activity_type      tinyint                 not null comment '(1:Buy,2:Sell)',
    user_address       varchar(42)             null comment '对于buy,sell类型指的是交易的发起者，即用户address',
    token_symbol       varchar(10)             not null,
    current_price      decimal(30) default 0   comment '货币价格(1表示eth)',
    token_amount       decimal(30) default 0   not null comment 'token数量',
    currency_amount    decimal(30) default 0   not null comment '法币数量',
    block_number       bigint      default 0   not null comment '区块号',
    tx_hash            varchar(66)             null comment '交易事务hash',
    event_time         bigint                  null comment '链上事件发生的时间',
    create_time        bigint                  null comment '创建时间',
    update_time        bigint                  null comment '更新时间',
    constraint index_tx_stock_token_type
        unique (tx_hash, token_symbol,  activity_type)
)
    collate = utf8mb4_general_ci;