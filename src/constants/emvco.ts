import { currencyCodes } from './iso4217'
import { merchantCategoryCodes } from './mcc'

export const DATA_OBJECT_DEFINITIONS: Record<
  string,
  {
    name: string
    format: string
    description: string
    subFields?: Record<
      string,
      {
        name: string
        format: string
        description: string
        subFields?: Record<
          string,
          {
            name: string
            format: string
            description: string
            payload_description?: Record<string, string>
          }
        >
        payload_description?: Record<string, string>
      }
    >
    payload_description?: Record<string, string>
  }
> = {
  '00': {
    name: 'Payload Format Indicator',
    format: 'N',
    description: 'Indicates the data representation format',
  },
  '01': {
    name: 'Point of Initiation Method',
    format: 'N',
    description: `Indicates whether QR is for static (11) or dynamic (12) payment`,
    payload_description: {
      '11': 'Static QR Code',
      '12': 'Dynamic QR Code',
    },
  },
  '02-25': {
    name: 'Merchant Account Information',
    format: 'ans',
    description: 'Merchant account information, can include multiple fields',
  },
  '26-37': {
    name: 'Merchant Account Information Template',
    format: 'S',
    description: 'Template for merchant account information',
    subFields: {
      '00': {
        name: 'Globally Unique Identifier (GUID)',
        format: 'ans',
        description: `An identifier that sets the context
of the data that follows.
The value is one of the following:
• an Application Identifier
(AID);
• a [UUID] without the hyphen
(-) separators;
• a reverse domain name.`,
      },
      '01-99': {
        name: 'Payment Network Specific Data',
        format: 's',
        description: `Association of data objects to
IDs and type of data object is
specific to the Globally Unique
Identifier.`,
      },
    },
  },
  '38': {
    name: 'VietQR Code through NAPAS',
    format: 'S',
    description: 'VietQR code data structure',
    subFields: {
      '00': {
        name: 'Globally Unique Identifier (GUID)',
        format: 'ans',
        description: `An identifier that sets the context
of the data that follows.
The value is one of the following:
• an Application Identifier
(AID);
• a [UUID] without the hyphen
(-) separators;
• a reverse domain name.`,
        payload_description: {
          A000000727: 'GUID for NAPAS247',
        },
      },
      '01': {
        name: 'Payment Network Specific Data',
        format: 's',
        description: `Association of data objects to
IDs and type of data object is
specific to the Globally Unique
Identifier.`,
        subFields: {
          '00': {
            name: 'Acquirer ID',
            format: 's',
            description: 'Acquirer identifier',
            payload_description: {
              '970436': 'Vietcombank',
              '970418': 'BIDV',
              '970448': 'OCB',
              '970415': 'VietinBank',
              '970407': 'Techcombank',
              '970405': 'Agribank',
              '970419': 'Navibank',
              '970403': 'Sacombank',
              '970416': 'ACB',
              '970454': 'Ban Viet',
              '970432': 'VPBank',
              '970423': 'TPBank',
              '970422': 'MB Bank',
              '970424': 'Shinhan Bank',
              '970441': 'VPBank',
              '970443': 'SHB',
              '970431': 'Eximbank',
              '970438': 'BaoViet Bank',
              '970429': 'SCB',
              '970421': 'Vietnam Russia Bank',
              '970425': 'ABBank',
              '970412': 'PVCombank',
              '970414': 'OceanBank',
              '970428': 'NamA Bank',
              '970437': 'HDBank',
              '970433': 'VietBank',
              '970460': 'VietCredit',
              '970439': 'Public Bank',
              '970442': 'Hongleong Bank',
              '970430': 'PG Bank',
              '970446': 'Co.op Bank',
              '422589': 'CIMB',
              '970434': 'Indovina',
              '970406': 'DongABank',
              '970408': 'GPBank',
              '970409': 'BacABank',
              '970427': 'VietABank',
              '970400': 'SaigonBank',
              '970426': 'Maritime Bank',
              '970449': 'LienVietPostBank',
              '970452': 'KienLongBank',
              '970455': 'IBK - Ha Noi',
              '970457': 'Woori Bank',
              '970440': 'SeABank',
              '970458': 'UOB',
              '970468': 'Mirae Asset',
              '970466': 'Keb Hana - Ho Chi Minh',
              '970467': 'Keb Hana - Ha Noi',
              '970410': 'Standard Chartered',
              '546034': 'CAKE',
              '546035': 'Ubank',
              '801011': 'Nonghyup Bank - HN',
              '970462': 'Kookmin - HN',
              '970463': 'Kookmin - HCM',
              '796500': 'DBS - HCM',
              '970444': 'CBBank',
              '668888': 'KBank - HCM',
              '458761': 'HSBC',
            },
          },
          '01': {
            name: 'Merchant ID',
            format: 's',
            description: 'Merchant identifier',
          },
        },
      },
      '02': {
        name: 'Service Code',
        format: 's',
        description: 'Service code for the transaction',
        payload_description: {
          QRIBFTTC: 'NAPAS247 through QR to Card',
          QRIBFTTA: 'NAPAS247 through QR to Account',
        },
      },
    },
  },
  '39-51': {
    name: 'Merchant Account Information Template',
    format: 'S',
    description: 'Template for merchant account information',
    subFields: {
      '00': {
        name: 'Globally Unique Identifier (GUID)',
        format: 'ans',
        description: `An identifier that sets the context
of the data that follows.
The value is one of the following:
• an Application Identifier
(AID);
• a [UUID] without the hyphen
(-) separators;
• a reverse domain name.`,
      },
      '01-99': {
        name: 'Payment Network Specific Data',
        format: 's',
        description: `Association of data objects to
IDs and type of data object is
specific to the Globally Unique
Identifier.`,
      },
    },
  },
  '52': {
    name: 'Merchant Category Code',
    format: 'N',
    description: '4-digit merchant category code',
    payload_description: merchantCategoryCodes,
  },
  '53': {
    name: 'Transaction Currency',
    format: 'N',
    description: 'ISO 4217 currency code',
    payload_description: currencyCodes,
  },
  '54': { name: 'Transaction Amount', format: 'ans', description: 'Transaction amount' },
  '55': {
    name: 'Tip or Convenience Indicator',
    format: 'N',
    description: 'Tip or convenience fee indicator',
  },
  '56': {
    name: 'Value of Convenience Fee Fixed',
    format: 'ans',
    description: 'Fixed convenience fee amount',
  },
  '57': {
    name: 'Value of Convenience Fee Percentage',
    format: 'ans',
    description: 'Percentage convenience fee',
  },
  '58': { name: 'Country Code', format: 'ans', description: 'ISO 3166-1 alpha 2 country code' },
  '59': { name: 'Merchant Name', format: 'ans', description: 'Merchant name' },
  '60': { name: 'Merchant City', format: 'ans', description: 'Merchant city' },
  '61': { name: 'Postal Code', format: 'ans', description: 'Merchant postal code' },
  '62': {
    name: 'Additional Data Field Template',
    format: 'S',
    description: 'Additional data fields',
    subFields: {
      '01': {
        name: 'Bill Number',
        format: 'ans',
        description: 'Bill number or invoice number',
      },
      '02': {
        name: 'Mobile Number',
        format: 'ans',
        description: 'Mobile number',
      },
      '03': {
        name: 'Store Label',
        format: 'ans',
        description: 'Store label or store ID',
      },
      '04': {
        name: 'Loyalty Number',
        format: 'ans',
        description: 'Loyalty card number',
      },
      '05': {
        name: 'Reference Label',
        format: 'ans',
        description: 'Reference label',
      },
      '06': {
        name: 'Customer Label',
        format: 'ans',
        description: 'Customer label',
      },
      '07': {
        name: 'Terminal Label',
        format: 'ans',
        description: 'Terminal label',
      },
      '08': {
        name: 'Purpose of Transaction',
        format: 'ans',
        description: 'Purpose of the transaction',
      },
      '09': {
        name: 'Additional Consumer Data Request',
        format: 'ans',
        description: 'Additional consumer data request A(address), M(Mobile), E(Email)',
      },
      '10': {
        name: 'Merchant Tax ID',
        format: 'ans',
        description: 'Merchant tax identification number',
      },
      '11': {
        name: 'Merchant Channel',
        format: 'ans',
        description: 'Channel through which the transaction is processed',
      },
      '12-49': {
        name: 'RFU for EMVCo',
        format: 's',
        description: 'Reserved for future use by EMVCo',
      },
      '50-99': {
        name: 'Payment System Specific Template',
        format: 's',
        description: 'Payment system specific data',
      },
    },
  },
  '63': { name: 'CRC', format: 'ans', description: 'Checksum for data integrity' },
  '64': {
    name: 'Merchant Information—Language Template',
    format: 'S',
    description: 'Merchant information in alternate language',
    subFields: {
      '00': {
        name: 'Language Preference',
        format: 'ans',
        description: 'Preferred language for merchant information',
      },
      '01': {
        name: 'Merchangt Name in Alternate Language',
        format: 'ans',
        description: 'Merchant name in the preferred language',
      },
      '02': {
        name: 'Merchant City in Alternate Language',
        format: 'ans',
        description: 'Merchant city in the preferred language',
      },
      '03-99': {
        name: 'Reserved for Future Use',
        format: 's',
        description: 'Reserved for future use by EMVCo',
      },
    },
  },
  '65-79': {
    name: 'RFU for EMVCo',
    format: 's',
    description: 'Reserved for future use by EMVCo',
  },
  '80-99': {
    name: 'Unreserved Templates',
    format: 's',
    description:
      'Unreserved Templates can be allocated and used by other parties, such as (domestic) payment systems and value-added service providers, for their own products.',
    subFields: {
      '00': {
        name: 'Globally Unique',
        format: 'ans',
        description: 'An identifier that sets the context',
      },
      '01-99': {
        name: 'Context-Specific Data',
        format: 's',
        description:
          'Association of data objects to IDs and type of data object is specific to the Globally Unique Identifier.',
      },
    },
  },
}

export const getDefinition = (id: string, parentDefinition?: any) => {
  const definitions = parentDefinition ? parentDefinition.subFields : DATA_OBJECT_DEFINITIONS
  for (const key in definitions) {
    if (key.includes('-')) {
      const [start, end] = key.split('-').map(Number)
      const numId = Number(id)
      if (numId >= start && numId <= end) {
        return definitions[key]
      }
    } else if (key === id) {
      return definitions[key]
    }
  }
  return null
}

export const getAllowedFieldIds = (parentDefinition?: any): string[] => {
  const ids: string[] = []
  for (let i = 0; i <= 99; i++) {
    const idStr = i.toString().padStart(2, '0')
    if (getDefinition(idStr, parentDefinition)) {
      ids.push(idStr)
    }
  }
  return ids
}
