package com.example.demo.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import org.hibernate.annotations.Nationalized

@Entity
@Table(name = "`Roles`", schema = "dbo")
open class Role {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "`Id`", nullable = false)
    open var id: Int? = null

    @Size(max = 50)
    @NotNull
    @Nationalized
    @Column(name = "`Name`", nullable = false, length = 50)
    open var name: String? = null

    @Size(max = 255)
    @Nationalized
    @Column(name = "`Description`")
    open var description: String? = null

}