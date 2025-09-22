
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
    index_type         tinyint default 0 not null comment '0:activity, 1:trade info, 2:listing,3:sale,4:exchange,5:floor price',
    create_time        bigint            null,
    update_time        bigint            null
)
    collate = utf8mb4_general_ci;