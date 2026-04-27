package models

import (
	"time"
)

// ============================================================================
// Agent Models
// ============================================================================

type Agent struct {
	ID         string     `gorm:"primaryKey;size:191" json:"id"`
	Name       string     `gorm:"not null" json:"name"`
	Phone      string     `gorm:"uniqueIndex;not null" json:"phone"`
	Email      *string    `json:"email"`
	Address    *string    `json:"address"`
	IsActive   bool       `gorm:"column:isActive;default:true" json:"isActive"`
	Balance    int        `gorm:"default:0" json:"balance"`
	MinBalance int        `gorm:"column:minBalance;default:0" json:"minBalance"`
	RouterID   *string    `gorm:"column:routerId;index" json:"routerId"`
	LastLogin  *time.Time `gorm:"column:lastLogin" json:"lastLogin"`
	CreatedAt  time.Time  `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt  time.Time  `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (Agent) TableName() string { return "agents" }

type AgentSale struct {
	ID            string     `gorm:"primaryKey;size:191" json:"id"`
	AgentID       string     `gorm:"column:agentId;index;not null" json:"agentId"`
	VoucherCode   string     `gorm:"column:voucherCode;not null" json:"voucherCode"`
	ProfileName   string     `gorm:"column:profileName;not null" json:"profileName"`
	Amount        int        `gorm:"not null" json:"amount"`
	PaymentStatus string     `gorm:"column:paymentStatus;default:UNPAID" json:"paymentStatus"`
	PaymentDate   *time.Time `gorm:"column:paymentDate" json:"paymentDate"`
	PaymentMethod *string    `gorm:"column:paymentMethod" json:"paymentMethod"`
	PaymentNote   *string    `gorm:"column:paymentNote;type:text" json:"paymentNote"`
	PaidAmount    int        `gorm:"column:paidAmount;default:0" json:"paidAmount"`
	CreatedAt     time.Time  `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`

	Agent *Agent `gorm:"foreignKey:AgentID" json:"agent,omitempty"`
}

func (AgentSale) TableName() string { return "agent_sales" }

type AgentDeposit struct {
	ID                      string     `gorm:"primaryKey;size:191" json:"id"`
	AgentID                 string     `gorm:"column:agentId;index;not null" json:"agentId"`
	Amount                  int        `gorm:"not null" json:"amount"`
	Status                  string     `gorm:"default:PENDING" json:"status"`
	PaymentGateway          *string    `gorm:"column:paymentGateway" json:"paymentGateway"`
	PaymentToken            *string    `gorm:"column:paymentToken;uniqueIndex" json:"paymentToken"`
	PaymentUrl              *string    `gorm:"column:paymentUrl;type:text" json:"paymentUrl"`
	TransactionID           *string    `gorm:"column:transactionId" json:"transactionId"`
	TargetBankName          *string    `gorm:"column:targetBankName" json:"targetBankName"`
	TargetBankAccountNumber *string    `gorm:"column:targetBankAccountNumber" json:"targetBankAccountNumber"`
	TargetBankAccountName   *string    `gorm:"column:targetBankAccountName" json:"targetBankAccountName"`
	SenderAccountName       *string    `gorm:"column:senderAccountName" json:"senderAccountName"`
	SenderAccountNumber     *string    `gorm:"column:senderAccountNumber" json:"senderAccountNumber"`
	ReceiptImage            *string    `gorm:"column:receiptImage;type:text" json:"receiptImage"`
	Note                    *string    `gorm:"type:text" json:"note"`
	PaidAt                  *time.Time `gorm:"column:paidAt" json:"paidAt"`
	ExpiredAt               *time.Time `gorm:"column:expiredAt" json:"expiredAt"`
	CreatedAt               time.Time  `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt               time.Time  `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`

	Agent *Agent `gorm:"foreignKey:AgentID" json:"agent,omitempty"`
}

func (AgentDeposit) TableName() string { return "agent_deposits" }

type AgentNotification struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	AgentID   string    `gorm:"column:agentId;index;not null" json:"agentId"`
	Type      string    `gorm:"not null" json:"type"`
	Title     string    `gorm:"not null" json:"title"`
	Message   string    `gorm:"type:text;not null" json:"message"`
	Link      *string   `json:"link"`
	IsRead    bool      `gorm:"column:isRead;default:false" json:"isRead"`
	CreatedAt time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`

	Agent *Agent `gorm:"foreignKey:AgentID" json:"agent,omitempty"`
}

func (AgentNotification) TableName() string { return "agent_notifications" }

// ============================================================================
// Technician Models
// ============================================================================

type Technician struct {
	ID          string     `gorm:"primaryKey" json:"id"`
	Name        string     `gorm:"not null" json:"name"`
	PhoneNumber string     `gorm:"column:phoneNumber;uniqueIndex;not null" json:"phoneNumber"`
	Email       *string    `json:"email"`
	IsActive    bool       `gorm:"column:isActive;default:true" json:"isActive"`
	RequireOtp  bool       `gorm:"column:requireOtp;default:true" json:"requireOtp"`
	LastLoginAt *time.Time `gorm:"column:lastLoginAt" json:"lastLoginAt"`
	CreatedAt   time.Time  `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time  `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (Technician) TableName() string { return "technicians" }

type TechnicianOtp struct {
	ID           string    `gorm:"primaryKey" json:"id"`
	TechnicianID string    `gorm:"column:technicianId;index;not null" json:"technicianId"`
	PhoneNumber  string    `gorm:"column:phoneNumber;index;not null" json:"phoneNumber"`
	OtpCode      string    `gorm:"column:otpCode;index;not null" json:"otpCode"`
	IsUsed       bool      `gorm:"column:isUsed;default:false" json:"isUsed"`
	ExpiresAt    time.Time `gorm:"column:expiresAt;index;not null" json:"expiresAt"`
	CreatedAt    time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`

	Technician *Technician `gorm:"foreignKey:TechnicianID" json:"technician,omitempty"`
}

func (TechnicianOtp) TableName() string { return "technician_otps" }

type WorkOrder struct {
	ID              string     `gorm:"primaryKey" json:"id"`
	TechnicianID    *string    `gorm:"column:technicianId;index" json:"technicianId"`
	CustomerName    string     `gorm:"column:customerName;not null" json:"customerName"`
	CustomerPhone   string     `gorm:"column:customerPhone;not null" json:"customerPhone"`
	CustomerAddress string     `gorm:"column:customerAddress;type:text;not null" json:"customerAddress"`
	IssueType       string     `gorm:"column:issueType;not null" json:"issueType"`
	Description     string     `gorm:"type:text;not null" json:"description"`
	Priority        string     `gorm:"default:MEDIUM" json:"priority"`
	Status          string     `gorm:"default:OPEN" json:"status"`
	ScheduledDate   *time.Time `gorm:"column:scheduledDate" json:"scheduledDate"`
	EstimatedHours  *float64   `gorm:"column:estimatedHours" json:"estimatedHours"`
	Notes           *string    `gorm:"type:text" json:"notes"`
	TechnicianNotes *string    `gorm:"column:technicianNotes;type:text" json:"technicianNotes"`
	CompletedAt     *time.Time `gorm:"column:completedAt" json:"completedAt"`
	AssignedAt      *time.Time `gorm:"column:assignedAt" json:"assignedAt"`
	CreatedAt       time.Time  `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time  `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`

	Technician *Technician `gorm:"foreignKey:TechnicianID" json:"technician,omitempty"`
}

func (WorkOrder) TableName() string { return "work_orders" }

// ============================================================================
// Ticket Models
// ============================================================================

type TicketCategory struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"uniqueIndex;not null" json:"name"`
	Description *string   `gorm:"type:text" json:"description"`
	Color       *string   `json:"color"`
	IsActive    bool      `gorm:"column:isActive;default:true" json:"isActive"`
	CreatedAt   time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (TicketCategory) TableName() string { return "ticket_categories" }

type Ticket struct {
	ID             string     `gorm:"primaryKey" json:"id"`
	TicketNumber   string     `gorm:"column:ticketNumber;uniqueIndex;not null" json:"ticketNumber"`
	CustomerID     *string    `gorm:"column:customerId;index" json:"customerId"`
	CustomerName   string     `gorm:"column:customerName;not null" json:"customerName"`
	CustomerEmail  *string    `gorm:"column:customerEmail" json:"customerEmail"`
	CustomerPhone  string     `gorm:"column:customerPhone;not null" json:"customerPhone"`
	Subject        string     `gorm:"not null" json:"subject"`
	Description    string     `gorm:"type:text;not null" json:"description"`
	CategoryID     *string    `gorm:"column:categoryId;index" json:"categoryId"`
	Priority       string     `gorm:"default:MEDIUM" json:"priority"`
	Status         string     `gorm:"default:OPEN" json:"status"`
	AssignedToID   *string    `gorm:"column:assignedToId;index" json:"assignedToId"`
	AssignedToType *string    `gorm:"column:assignedToType" json:"assignedToType"`
	ClosedAt       *time.Time `gorm:"column:closedAt" json:"closedAt"`
	ResolvedAt     *time.Time `gorm:"column:resolvedAt" json:"resolvedAt"`
	LastResponseAt *time.Time `gorm:"column:lastResponseAt" json:"lastResponseAt"`
	CreatedAt      time.Time  `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt      time.Time  `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`

	Category *TicketCategory `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Messages []TicketMessage `gorm:"foreignKey:TicketID" json:"messages,omitempty"`
}

func (Ticket) TableName() string { return "tickets" }

type TicketMessage struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	TicketID    string    `gorm:"column:ticketId;index;not null" json:"ticketId"`
	SenderType  string    `gorm:"column:senderType;not null" json:"senderType"`
	SenderID    *string   `gorm:"column:senderId" json:"senderId"`
	SenderName  string    `gorm:"column:senderName;not null" json:"senderName"`
	Message     string    `gorm:"type:text;not null" json:"message"`
	IsInternal  bool      `gorm:"column:isInternal;default:false" json:"isInternal"`
	Attachments *string   `gorm:"type:text" json:"attachments"`
	CreatedAt   time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
}

func (TicketMessage) TableName() string { return "ticket_messages" }

// ============================================================================
// Notification Model
// ============================================================================

type Notification struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	Type      string    `gorm:"not null" json:"type"`
	Title     string    `gorm:"not null" json:"title"`
	Message   string    `gorm:"type:text;not null" json:"message"`
	Link      *string   `json:"link"`
	IsRead    bool      `gorm:"column:isRead;default:false" json:"isRead"`
	CreatedAt time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
}

func (Notification) TableName() string { return "notifications" }

// ============================================================================
// Financial (Keuangan) Models
// ============================================================================

type TransactionCategory struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"uniqueIndex;not null" json:"name"`
	Type        string    `gorm:"not null" json:"type"` // INCOME, EXPENSE
	Description *string   `gorm:"type:text" json:"description"`
	IsActive    bool      `gorm:"column:isActive;default:true" json:"isActive"`
	CreatedAt   time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (TransactionCategory) TableName() string { return "transaction_categories" }

type Transaction struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	CategoryID  string    `gorm:"column:categoryId;index;not null" json:"categoryId"`
	Type        string    `gorm:"not null" json:"type"` // INCOME, EXPENSE
	Amount      int       `gorm:"not null" json:"amount"`
	Description string    `gorm:"type:text;not null" json:"description"`
	Date        time.Time `gorm:"default:now()" json:"date"`
	Reference   *string   `json:"reference"`
	Notes       *string   `gorm:"type:text" json:"notes"`
	CreatedBy   *string   `gorm:"column:createdBy" json:"createdBy"`
	CreatedAt   time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`

	Category *TransactionCategory `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
}

func (Transaction) TableName() string { return "transactions" }

// ============================================================================
// Inventory Models
// ============================================================================

type InventoryCategory struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"uniqueIndex;not null" json:"name"`
	Description *string   `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (InventoryCategory) TableName() string { return "inventory_categories" }

type InventorySupplier struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"uniqueIndex;not null" json:"name"`
	ContactName *string   `gorm:"column:contactName" json:"contactName"`
	Phone       *string   `json:"phone"`
	Email       *string   `json:"email"`
	Address     *string   `gorm:"type:text" json:"address"`
	Notes       *string   `gorm:"type:text" json:"notes"`
	IsActive    bool      `gorm:"column:isActive;default:true" json:"isActive"`
	CreatedAt   time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (InventorySupplier) TableName() string { return "inventory_suppliers" }

type InventoryItem struct {
	ID            string    `gorm:"primaryKey" json:"id"`
	SKU           string    `gorm:"uniqueIndex;not null" json:"sku"`
	Name          string    `gorm:"not null" json:"name"`
	Description   *string   `gorm:"type:text" json:"description"`
	CategoryID    *string   `gorm:"column:categoryId;index" json:"categoryId"`
	SupplierID    *string   `gorm:"column:supplierId;index" json:"supplierId"`
	Unit          string    `gorm:"default:pcs" json:"unit"`
	MinimumStock  int       `gorm:"column:minimumStock;default:0" json:"minimumStock"`
	CurrentStock  int       `gorm:"column:currentStock;default:0" json:"currentStock"`
	PurchasePrice int       `gorm:"column:purchasePrice;default:0" json:"purchasePrice"`
	SellingPrice  int       `gorm:"column:sellingPrice;default:0" json:"sellingPrice"`
	Location      *string   `json:"location"`
	Notes         *string   `gorm:"type:text" json:"notes"`
	IsActive      bool      `gorm:"column:isActive;default:true" json:"isActive"`
	CreatedAt     time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`

	Category *InventoryCategory `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Supplier *InventorySupplier `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
}

func (InventoryItem) TableName() string { return "inventory_items" }

type InventoryMovement struct {
	ID            string    `gorm:"primaryKey" json:"id"`
	ItemID        string    `gorm:"column:itemId;index;not null" json:"itemId"`
	MovementType  string    `gorm:"column:movementType;not null" json:"movementType"` // IN, OUT, ADJUSTMENT
	Quantity      int       `gorm:"not null" json:"quantity"`
	PreviousStock int       `gorm:"column:previousStock;not null" json:"previousStock"`
	NewStock      int       `gorm:"column:newStock;not null" json:"newStock"`
	ReferenceNo   *string   `gorm:"column:referenceNo" json:"referenceNo"`
	Notes         *string   `gorm:"type:text" json:"notes"`
	UserID        *string   `gorm:"column:userId" json:"userId"`
	UserName      *string   `gorm:"column:userName" json:"userName"`
	CreatedAt     time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`

	Item *InventoryItem `gorm:"foreignKey:ItemID" json:"item,omitempty"`
}

func (InventoryMovement) TableName() string { return "inventory_movements" }

// ============================================================================
// Registration Model
// ============================================================================

type RegistrationRequest struct {
	ID              string    `gorm:"primaryKey;size:191" json:"id"`
	Name            string    `gorm:"not null" json:"name"`
	Phone           string    `gorm:"uniqueIndex;not null" json:"phone"`
	Email           *string   `json:"email"`
	Latitude        *float64  `json:"latitude"`
	Longitude       *float64  `json:"longitude"`
	Address         string    `gorm:"not null" json:"address"`
	ProfileID       string    `gorm:"column:profileId;index;not null" json:"profileId"`
	InstallationFee float64   `gorm:"column:installationFee;type:decimal(10,2);default:0" json:"installationFee"`
	Notes           *string   `gorm:"type:text" json:"notes"`
	ReferralCode    *string   `gorm:"column:referralCode" json:"referralCode"`
	IDCardNumber    *string   `gorm:"column:idCardNumber" json:"idCardNumber"`
	IDCardPhoto     *string   `gorm:"column:idCardPhoto;type:text" json:"idCardPhoto"`
	AreaID          *string   `gorm:"column:areaId;index" json:"areaId"`
	Status          string    `gorm:"default:PENDING" json:"status"`
	RejectionReason *string   `gorm:"column:rejectionReason;type:text" json:"rejectionReason"`
	InvoiceID       *string   `gorm:"column:invoiceId;uniqueIndex" json:"invoiceId"`
	PppoeUserID     *string   `gorm:"column:pppoeUserId;uniqueIndex" json:"pppoeUserId"`
	CreatedAt       time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (RegistrationRequest) TableName() string { return "registration_requests" }

// ============================================================================
// Backup Model
// ============================================================================

type BackupHistory struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	Filename  string    `gorm:"not null" json:"filename"`
	Filepath  *string   `json:"filepath"`
	Filesize  int64     `gorm:"not null" json:"filesize"`
	Type      string    `gorm:"not null" json:"type"`        // auto, manual
	Status    string    `gorm:"not null" json:"status"`      // success, failed
	Method    string    `gorm:"default:local" json:"method"` // local, telegram, both
	Error     *string   `gorm:"type:text" json:"error"`
	CreatedAt time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
}

func (BackupHistory) TableName() string { return "backup_history" }

// ============================================================================
// Telegram Backup Settings
// ============================================================================

type TelegramBackupSettings struct {
	ID            string    `gorm:"primaryKey" json:"id"`
	Enabled       bool      `gorm:"default:false" json:"enabled"`
	BotToken      string    `gorm:"column:botToken;not null" json:"botToken"`
	ChatID        string    `gorm:"column:chatId;not null" json:"chatId"`
	BackupTopicID *string   `gorm:"column:backupTopicId" json:"backupTopicId"`
	HealthTopicID *string   `gorm:"column:healthTopicId" json:"healthTopicId"`
	Schedule      string    `gorm:"default:daily" json:"schedule"`
	ScheduleTime  string    `gorm:"column:scheduleTime;default:02:00" json:"scheduleTime"`
	KeepLastN     int       `gorm:"column:keepLastN;default:7" json:"keepLastN"`
	CreatedAt     time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (TelegramBackupSettings) TableName() string { return "telegram_backup_settings" }

// ============================================================================
// Permission Models
// ============================================================================

type Permission struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	Key         string    `gorm:"uniqueIndex;not null" json:"key"`
	Name        string    `gorm:"not null" json:"name"`
	Description *string   `gorm:"type:text" json:"description"`
	Category    string    `gorm:"index;not null" json:"category"`
	IsActive    bool      `gorm:"column:isActive;default:true" json:"isActive"`
	CreatedAt   time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (Permission) TableName() string { return "permissions" }

type RolePermission struct {
	ID           string    `gorm:"primaryKey" json:"id"`
	Role         string    `gorm:"index;not null" json:"role"`
	PermissionID string    `gorm:"column:permissionId;index;not null" json:"permissionId"`
	CreatedAt    time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`

	Permission *Permission `gorm:"foreignKey:PermissionID" json:"permission,omitempty"`
}

func (RolePermission) TableName() string { return "role_permissions" }

type UserPermission struct {
	ID           string    `gorm:"primaryKey" json:"id"`
	UserID       string    `gorm:"column:userId;index;not null" json:"userId"`
	PermissionID string    `gorm:"column:permissionId;index;not null" json:"permissionId"`
	CreatedAt    time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`

	Permission *Permission `gorm:"foreignKey:PermissionID" json:"permission,omitempty"`
}

func (UserPermission) TableName() string { return "user_permissions" }

// ============================================================================
// Manual Payment Model
// ============================================================================

type ManualPayment struct {
	ID              string     `gorm:"primaryKey" json:"id"`
	UserID          string     `gorm:"column:userId;index;not null" json:"userId"`
	InvoiceID       string     `gorm:"column:invoiceId;index;not null" json:"invoiceId"`
	Amount          float64    `gorm:"type:decimal(10,2);not null" json:"amount"`
	PaymentDate     time.Time  `gorm:"column:paymentDate;not null" json:"paymentDate"`
	BankName        string     `gorm:"column:bankName;not null" json:"bankName"`
	AccountNumber   *string    `gorm:"column:accountNumber" json:"accountNumber"`
	AccountName     string     `gorm:"column:accountName;not null" json:"accountName"`
	ReceiptImage    *string    `gorm:"column:receiptImage" json:"receiptImage"`
	Notes           *string    `gorm:"type:text" json:"notes"`
	Status          string     `gorm:"default:PENDING" json:"status"` // PENDING, APPROVED, REJECTED
	ApprovedBy      *string    `gorm:"column:approvedBy" json:"approvedBy"`
	ApprovedAt      *time.Time `gorm:"column:approvedAt" json:"approvedAt"`
	RejectionReason *string    `gorm:"column:rejectionReason;type:text" json:"rejectionReason"`
	CreatedAt       time.Time  `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time  `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (ManualPayment) TableName() string { return "manual_payments" }

// ============================================================================
// E-Voucher / Voucher Order
// ============================================================================

type VoucherOrder struct {
	ID            string     `gorm:"primaryKey;size:191" json:"id"`
	OrderNumber   string     `gorm:"column:orderNumber;uniqueIndex;not null" json:"orderNumber"`
	ProfileID     string     `gorm:"column:profileId;index;not null" json:"profileId"`
	Quantity      int        `gorm:"default:1" json:"quantity"`
	CustomerName  string     `gorm:"column:customerName;not null" json:"customerName"`
	CustomerPhone string     `gorm:"column:customerPhone;not null" json:"customerPhone"`
	CustomerEmail *string    `gorm:"column:customerEmail" json:"customerEmail"`
	TotalAmount   int        `gorm:"column:totalAmount;not null" json:"totalAmount"`
	Status        string     `gorm:"default:PENDING" json:"status"` // PENDING, PAID, CANCELLED, EXPIRED
	PaymentToken  *string    `gorm:"column:paymentToken;uniqueIndex" json:"paymentToken"`
	PaymentLink   *string    `gorm:"column:paymentLink" json:"paymentLink"`
	PaidAt        *time.Time `gorm:"column:paidAt" json:"paidAt"`
	CreatedAt     time.Time  `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time  `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (VoucherOrder) TableName() string { return "voucher_orders" }

// ============================================================================
// Voucher Template
// ============================================================================

type VoucherTemplate struct {
	ID           string    `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"not null" json:"name"`
	HtmlTemplate string    `gorm:"column:htmlTemplate;type:text;not null" json:"htmlTemplate"`
	IsDefault    bool      `gorm:"column:isDefault;default:false" json:"isDefault"`
	IsActive     bool      `gorm:"column:isActive;default:true" json:"isActive"`
	CreatedAt    time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (VoucherTemplate) TableName() string { return "voucher_templates" }

// ============================================================================
// Suspend Request
// ============================================================================

type SuspendRequest struct {
	ID          string     `gorm:"primaryKey" json:"id"`
	UserID      string     `gorm:"column:userId;index;not null" json:"userId"`
	Status      string     `gorm:"default:PENDING" json:"status"` // PENDING, APPROVED, REJECTED, CANCELLED
	Reason      *string    `gorm:"type:text" json:"reason"`
	StartDate   time.Time  `gorm:"column:startDate;not null" json:"startDate"`
	EndDate     time.Time  `gorm:"column:endDate;not null" json:"endDate"`
	AdminNotes  *string    `gorm:"column:adminNotes;type:text" json:"adminNotes"`
	RequestedAt time.Time  `gorm:"column:requestedAt;autoCreateTime" json:"requestedAt"`
	ApprovedAt  *time.Time `gorm:"column:approvedAt" json:"approvedAt"`
	ApprovedBy  *string    `gorm:"column:approvedBy" json:"approvedBy"`
	UpdatedAt   time.Time  `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (SuspendRequest) TableName() string { return "suspend_requests" }

// ============================================================================
// Email Models
// ============================================================================

type EmailSettings struct {
	ID              string    `gorm:"primaryKey" json:"id"`
	Enabled         bool      `gorm:"default:false" json:"enabled"`
	SmtpHost        string    `gorm:"column:smtpHost;default:smtp.gmail.com" json:"smtpHost"`
	SmtpPort        int       `gorm:"column:smtpPort;default:587" json:"smtpPort"`
	SmtpSecure      bool      `gorm:"column:smtpSecure;default:false" json:"smtpSecure"`
	SmtpUser        string    `gorm:"column:smtpUser" json:"smtpUser"`
	SmtpPassword    string    `gorm:"column:smtpPassword" json:"-"`
	FromEmail       string    `gorm:"column:fromEmail" json:"fromEmail"`
	FromName        string    `gorm:"column:fromName;default:RADIUS Notification" json:"fromName"`
	NotifyNewUser   bool      `gorm:"column:notifyNewUser;default:true" json:"notifyNewUser"`
	NotifyExpired   bool      `gorm:"column:notifyExpired;default:true" json:"notifyExpired"`
	NotifyInvoice   bool      `gorm:"column:notifyInvoice;default:true" json:"notifyInvoice"`
	NotifyPayment   bool      `gorm:"column:notifyPayment;default:true" json:"notifyPayment"`
	ReminderEnabled bool      `gorm:"column:reminderEnabled;default:true" json:"reminderEnabled"`
	ReminderTime    string    `gorm:"column:reminderTime;default:09:00" json:"reminderTime"`
	ReminderDays    string    `gorm:"column:reminderDays;default:7,3,1" json:"reminderDays"`
	CreatedAt       time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (EmailSettings) TableName() string { return "email_settings" }

type EmailHistory struct {
	ID      string    `gorm:"primaryKey" json:"id"`
	ToEmail string    `gorm:"column:toEmail;index;not null" json:"toEmail"`
	ToName  *string   `gorm:"column:toName" json:"toName"`
	Subject string    `gorm:"not null" json:"subject"`
	Body    string    `gorm:"type:text;not null" json:"body"`
	Status  string    `gorm:"not null" json:"status"` // sent, failed
	Error   *string   `gorm:"type:text" json:"error"`
	SentAt  time.Time `gorm:"column:sentAt;autoCreateTime" json:"sentAt"`
}

func (EmailHistory) TableName() string { return "email_history" }

type EmailTemplate struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"not null" json:"name"`
	Type      string    `gorm:"uniqueIndex;not null" json:"type"`
	Subject   string    `gorm:"not null" json:"subject"`
	HtmlBody  string    `gorm:"column:htmlBody;type:text;not null" json:"htmlBody"`
	IsActive  bool      `gorm:"column:isActive;default:true" json:"isActive"`
	CreatedAt time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (EmailTemplate) TableName() string { return "email_templates" }

// ============================================================================
// Customer Session (for customer portal OTP login)
// ============================================================================

type CustomerSession struct {
	ID        string     `gorm:"primaryKey" json:"id"`
	UserID    string     `gorm:"column:userId;index;not null" json:"userId"`
	Phone     string     `gorm:"index;not null" json:"phone"`
	OtpCode   *string    `gorm:"column:otpCode" json:"otpCode,omitempty"`
	OtpExpiry *time.Time `gorm:"column:otpExpiry" json:"otpExpiry,omitempty"`
	Token     *string    `gorm:"uniqueIndex" json:"token,omitempty"`
	ExpiresAt *time.Time `gorm:"column:expiresAt" json:"expiresAt,omitempty"`
	Verified  bool       `gorm:"default:false" json:"verified"`
	CreatedAt time.Time  `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time  `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (CustomerSession) TableName() string { return "customer_sessions" }

// ============================================================================
// Cron History
// ============================================================================

type CronHistory struct {
	ID          string     `gorm:"primaryKey" json:"id"`
	JobType     string     `gorm:"column:jobType;index;not null" json:"jobType"`
	Status      string     `gorm:"index;not null" json:"status"` // running, success, error
	StartedAt   time.Time  `gorm:"column:startedAt;index;autoCreateTime" json:"startedAt"`
	CompletedAt *time.Time `gorm:"column:completedAt" json:"completedAt"`
	Duration    *int       `json:"duration"`
	Result      *string    `gorm:"type:text" json:"result"`
	Error       *string    `gorm:"type:text" json:"error"`
}

func (CronHistory) TableName() string { return "cron_history" }

// ============================================================================
// Map Settings
// ============================================================================

type MapSettings struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	OsrmApiUrl  string    `gorm:"column:osrmApiUrl;default:http://router.project-osrm.org" json:"osrmApiUrl"`
	FollowRoad  bool      `gorm:"column:followRoad;default:false" json:"followRoad"`
	DefaultLat  float64   `gorm:"column:defaultLat;default:-7.071273611475302" json:"defaultLat"`
	DefaultLon  float64   `gorm:"column:defaultLon;default:108.04475042198051" json:"defaultLon"`
	DefaultZoom int       `gorm:"column:defaultZoom;default:13" json:"defaultZoom"`
	MapTheme    string    `gorm:"column:mapTheme;default:default" json:"mapTheme"`
	CreatedAt   time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (MapSettings) TableName() string { return "map_settings" }

// ============================================================================
// Push Broadcasts
// ============================================================================

type PushBroadcast struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	Title       string    `gorm:"not null" json:"title"`
	Body        string    `gorm:"type:text;not null" json:"body"`
	Type        string    `gorm:"default:broadcast" json:"type"`
	TargetType  string    `gorm:"column:targetType;default:all" json:"targetType"`
	TargetIDs   *string   `gorm:"column:targetIds;type:text" json:"targetIds"`
	SentCount   int       `gorm:"column:sentCount;default:0" json:"sentCount"`
	FailedCount int       `gorm:"column:failedCount;default:0" json:"failedCount"`
	SentBy      *string   `gorm:"column:sentBy" json:"sentBy"`
	Data        *string   `gorm:"type:text" json:"data"`
	CreatedAt   time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
}

func (PushBroadcast) TableName() string { return "push_broadcasts" }

// Area - Wilayah/coverage area untuk pelanggan PPPoE
type Area struct {
	ID          string    `gorm:"primaryKey;size:191" json:"id"`
	Name        string    `gorm:"uniqueIndex;not null" json:"name"`
	Description *string   `json:"description"`
	IsActive    bool      `gorm:"column:isActive;default:true" json:"isActive"`
	CreatedAt   time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (Area) TableName() string { return "pppoe_areas" }
