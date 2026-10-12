CREATE TABLE [dbo].[DeviceCheckins](
    [Id] [int] IDENTITY(1,1) NOT NULL,
    [DeviceId] [nvarchar](100) NOT NULL,
    [EmployeeId] [nvarchar](50) NOT NULL,
    [CheckedInAt] [datetime2] NOT NULL CONSTRAINT [DF_DeviceCheckins_CheckedInAt] DEFAULT (GETDATE()),
    CONSTRAINT [PK_DeviceCheckins] PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [UQ_DeviceCheckins_DeviceId] UNIQUE NONCLUSTERED ([DeviceId] ASC)
) ON [PRIMARY]
GO
