package com.example.demo.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import org.hibernate.annotations.ColumnDefault
import org.hibernate.annotations.Nationalized
import java.math.BigDecimal
import java.time.Instant

@Entity
@Table(name = "`TransactionLogs`", schema = "dbo")
open class TransactionLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "`Id`", nullable = false)
    open var id: Long? = null

    @Size(max = 255)
    @NotNull
    @Nationalized
    @Column(name = "`TxHash`", nullable = false)
    open var txHash: String? = null

    @Size(max = 100)
    @NotNull
    @Nationalized
    @Column(name = "`ActionType`", nullable = false, length = 100)
    open var actionType: String? = null

    @Column(name = "`Amount`", precision = 38, scale = 18)
    open var amount: BigDecimal? = null

    @Size(max = 20)
    @NotNull
    @Nationalized
    @ColumnDefault("'PENDING'")
    @Column(name = "`Status`", nullable = false, length = 20)
    open var status: String? = null

    @NotNull
    @ColumnDefault("getdate()")
    @Column(name = "`CreatedAt`", nullable = false, columnDefinition = "datetime2")
    open var createdAt: Instant? = null

}