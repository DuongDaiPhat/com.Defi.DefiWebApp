package com.example.demo.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.OneToMany
import jakarta.persistence.PrePersist
import jakarta.persistence.PreUpdate
import jakarta.persistence.Table
import java.time.Instant
@Entity
@Table(name = "`Users`", schema = "dbo")
open class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "`Id`", nullable = false)
    open var id: Long? = null

    @Column(name = "`Wallet_Address`", nullable = false, length = 100)
    open var walletAddress: String? = null

    @Column(name = "`Nonce`")
    open var nonce: String? = null

    @Column(name = "`Role`", nullable = false, length = 50)
    open var role: String? = "USER"

    @Column(name = "`Status`", nullable = false, length = 20)
    open var status: String? = "ACTIVE"

    @Column(name = "`Created_At`", nullable = false, columnDefinition = "datetime2")
    open var createdAt: Instant? = null

    @Column(name = "`Updated_At`", columnDefinition = "datetime2")
    open var updatedAt: Instant? = null

    @OneToMany
    @JoinColumn(name = "`UserId`")
    open var transactionLogs: MutableSet<TransactionLog> = mutableSetOf()

    @PrePersist
    fun onCreate() {
        this.createdAt = Instant.now()
    }

    @PreUpdate
    fun onUpdate() {
        this.updatedAt = Instant.now()
    }

    companion object {
        @JvmStatic
        fun create(walletAddress: String): User {
            val user = User()
            user.walletAddress = walletAddress
            user.role = "USER"
            user.status = "ACTIVE"
            return user
        }
    }
}