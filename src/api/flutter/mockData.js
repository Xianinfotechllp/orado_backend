const categories = [
  {
    categoryId: 1,
    categoryName: "Fruits",
    restaurantId: "682c28a8e269347b428cd539",  // changed here
    categoryimagerelation: {
      imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQLDpqhgA4X70ByudPepForCDba05T8h3a0HQ&s"
    },
    categoryrelation1: [  
      {
        subCategoryId: 101,
        subcategoryName: "Apples",
        restaurantId: "682c28a8e269347b428cd539",  // changed here
        subcategoryImagerelation: {
          imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQqrup5s5xLJto6g7ua7wBuqFtHhrxuDPbV6A&s"
        }
      },
      {
        subCategoryId: 102,
        subcategoryName: "Bananas",
        restaurantId: "682c28a8e269347b428cd539",  // changed here
        subcategoryImagerelation: {
          imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRvB8TwVu6IajXBXGb_vmigdZmm7iTL-MUVhw&s"
        }
      }
    ]
  },
  {
    categoryId: 2,
    categoryName: "Vegetables",
    restaurantId: "6835cf75451788eb5e4e9e01",  // changed here
    categoryimagerelation: {
      imageName: "https://example.com/vegetables.jpg"
    },
    categoryrelation1: [
      {
        subCategoryId: 201,
        subcategoryName: "Tomatoes",
        restaurantId: "6835cf75451788eb5e4e9e01",  // changed here
        subcategoryImagerelation: {
          imageName: "https://example.com/tomatoes.jpg"
        }
      },
      {
        subCategoryId: 202,
        subcategoryName: "Spinach",
        restaurantId: "6835cf75451788eb5e4e9e01",  // changed here
        subcategoryImagerelation: {
          imageName: "https://example.com/spinach.jpg"
        }
      }
    ]
  },
  {
    categoryId: 3,
    categoryName: "Dairy",
    restaurantId: "rest_102",
    categoryimagerelation: {
      imageName: "https://example.com/dairy.jpg"
    },
    categoryrelation1: [
      {
        subCategoryId: 301,
        subcategoryName: "Milk",
        restaurantId: "rest_102",
        subcategoryImagerelation: {
          imageName: "https://example.com/milk.jpg"
        }
      },
      {
        subCategoryId: 302,
        subcategoryName: "Cheese",
        restaurantId: "rest_102",
        subcategoryImagerelation: {
          imageName: "https://example.com/cheese.jpg"
        }
      }
    ]
  },
  {
    categoryId: 4,
    categoryName: "Bakery",
    restaurantId: "rest_102",
    categoryimagerelation: {
      imageName: "https://example.com/bakery.jpg"
    },
    categoryrelation1: [
      {
        subCategoryId: 401,
        subcategoryName: "Bread",
        restaurantId: "rest_102",
        subcategoryImagerelation: {
          imageName: "https://example.com/bread.jpg"
        }
      },
      {
        subCategoryId: 402,
        subcategoryName: "Cakes",
        restaurantId: "rest_102",
        subcategoryImagerelation: {
          imageName: "https://example.com/cakes.jpg"
        }
      }
    ]
  },
  
  {
    categoryId: 5,
    categoryName: "Snacks",
    restaurantId: "6836b1e8201835ed8788e9c4",
    categoryimagerelation: {
      imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT8_W0qpAEt32KB_CpRoe1GhDUoDGTtcJZGoQ&sg"
    },
    categoryrelation1: [
      {
        subCategoryId: 501,
        subcategoryName: "Chips",
        restaurantId: "6836b1e8201835ed8788e9c4",
        subcategoryImagerelation: {
          imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQbozyzuTXDQd1farDoqlkhzinrfIzt_52-Aw&s"
        }
      },
      {
        subCategoryId: 502,
        subcategoryName: "Cookies",
        restaurantId: "6836b1e8201835ed8788e9c4",
        subcategoryImagerelation: {
          imageName: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQbdkFOcPtheaWkfyEERPaZDKCzP1Q_nwUYlQ&s"
        }
      }
    ]
  }
];


const restaurants = [
  {
    restaurantId: "6835cf75451788eb5e4e9e01",  // changed here
    name: "Fresh Farm Store",
    location: {
      type: "Point",
      coordinates: [78.4867, 17.3850], 
    },
    address: "Hyderabad, Telangana, India",
  },
  {
    restaurantId: "rest_102",
    name: "Green Veggies",
    location: {
      type: "Point",
      coordinates: [72.8777, 19.0760],
    },
    address: "Mumbai, Maharashtra, India",
  },
];

module.exports = { categories, restaurants };
