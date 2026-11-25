const states = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

module.exports = {
  states,
  gstTreatments: {
    registered_regular: 'Registered Business - Regular',
    registered_composition: 'Registered Business - Composition',
    unregistered: 'Unregistered Business',
    consumer: 'Consumer',
    overseas: 'Overseas',
    special_economic_zone: 'Special Economic Zone',
    deemed_export: 'Deemed Export',
    tax_deductor: 'Tax Deductor',
    sez_developer: 'SEZ Developer',
  },
  salutations: ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.'],
  paymentTerms: ['Due on Receipt', 'Net 3', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60'],
  languages: [
    'English', 'Hindi', 'Assamese', 'Bengali', 'Gujarati', 'Kannada', 'Malayalam',
    'Marathi', 'Odia', 'Punjabi', 'Tamil', 'Telugu', 'Urdu',
  ],
  currencies: ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'],
};
