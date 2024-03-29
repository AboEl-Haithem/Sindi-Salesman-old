import { Component, OnInit } from '@angular/core';
import {
  IonicPage, NavController, NavParams, ModalController, ViewController, LoadingController,
  AlertController, ActionSheetController, ToastController
} from 'ionic-angular';
import { Storage } from '@ionic/storage';
import { HTTP } from '@ionic-native/http';

import { SearchCustomerPage } from '../search-customer/search-customer';
import { AddCustomerPage } from '../add-customer/add-customer';
import { ItemsPage } from '../items/items';
import { ItemPage } from '../item/item';
import { PromotionsPage } from '../promotions/promotions';
import { PromotionOrderPage } from '../promotion-order/promotion-order';
import { BranchSettings } from '../../shared/branchSettings';

import { CustomerDTO } from '../../shared/customerDTO';
import { OrderItem } from '../../shared/orderItem';
import { UserDTO } from '../../shared/userDTO';
import { OrderRequest, ItemsTypes } from '../../shared/orderRequest';
import { CalcPromotion } from '../../shared/promotionsDTO';
import { Branches } from '../../shared/branchSettings';
import { PostService } from '../../shared/postServices';
import { GetService } from '../../shared/getServices';
import { UpdateService } from './update-service';
import { Connection } from '../../shared/connection';

@IonicPage()
@Component({
  selector: 'page-order',
  templateUrl: 'order.html',
  providers: [UpdateService]
})
export class OrderPage implements OnInit {
  branchSettings: BranchSettings = {};
  orderList: OrderItem[] = [];
  findCustomerOption: any;
  customer: CustomerDTO;
  CustomerAdded: boolean = false;
  userDTO: UserDTO;
  isUrgent = false;
  orderRequest: OrderRequest = {
    Datarow: {
      BranchID: '',
      CustomerID: '',
      SalesManID: '',
      Park: false,
      Edittable: true,
      Canceled: false
    }
  };
  branches: Branches[] = [];
  singleItems: OrderItem[] = [];
  singleItemsPrice: number;

  valueArray: any[] = [];
  valuePromotions: CalcPromotion[] = [];

  percentageArray: any[] = [];
  percentagePromotions: CalcPromotion[] = [];
  totalPercentage: number;

  pieceArray: any[] = [];
  piecePromotions: CalcPromotion[] = [];
  saveDisable = false;
  disableSave = false;

  totalPrice?: number;

  constructor(public navCtrl: NavController, public navParams: NavParams, public modalCtrl: ModalController,
    public viewCtrl: ViewController, public alertCtrl: AlertController, private storage: Storage,
    private postService: PostService, public actionSheetCtrl: ActionSheetController, private getServices: GetService
    , public loadingCtrl: LoadingController, private getService: GetService, public ToastCtrl: ToastController,
    private updateService: UpdateService, private http: HTTP, private connection: Connection) {
  }

  ngOnInit() {
    let loader = this.loadingCtrl.create({
      cssClass: 'transperant_loader'
    });
    loader.present();
    this.getService.GetAllBranches().subscribe(response => {
      this.branches = response;
      this.branches.push({
        BranchCode: 0,
        BranchName: 'أخرى'
      });
      loader.dismiss();
    }, err => {
      loader.dismiss();
      this.showError();
    });
    ////////////////// ADD More////////////////////
    if (this.navParams.data.mode == 'new') {
      this.storage.get('userId').then(data => {
        this.orderRequest.Datarow.SalesManID = data;
      });
      this.storage.get('branchId').then(data => {
        this.orderRequest.Datarow.BranchID = data;
        this.getServices.GetSettingByBranch(data).subscribe(response => {
          this.branchSettings = response;
          this.orderRequest.Datarow.OrderDeliveryDate = this.calcDates(this.branchSettings.NumOfDeliveryDays);
          this.orderRequest.Datarow.UrgentDeliveryDate = this.calcDates(this.branchSettings.NumOfurgentDeliveryDays);
        }, err => {
          loader.dismiss();
          this.showError();
        });
      });
      this.orderRequest.operation = "new";
    }
    ////////////////// EDIT More////////////////////    
    else if (this.navParams.data.mode == 'edit') {
      if (!this.navParams.data.data.Edittable) {
        this.disableSave = true;
      }
      this.orderRequest.Datarow = this.navParams.data.data;
      this.orderRequest.Datarow.SalesManID = this.navParams.data.data.SalesManID;
      this.orderRequest.Datarow.BranchID = this.navParams.data.data.BranchID;
      this.orderRequest.operation = "save";
      this.getService.GetCustomerByCode(this.orderRequest.Datarow.CustomerID).subscribe(res => {
        this.customer = res;
        this.CustomerAdded = true
        this.getService.getOrderItemsBySalesId(this.navParams.data.id).subscribe(response => {
          let fetchedItems = this.updateService.fetchItems(response);
          this.singleItems = fetchedItems.singleItems;
          this.singleItemsPrice = fetchedItems.singleItemsPrice;

          this.valuePromotions = fetchedItems.valuePromotions;
          this.valueArray = fetchedItems.valueArray;

          this.piecePromotions = fetchedItems.piecePromotions;
          this.pieceArray = fetchedItems.pieceArray;

          this.percentagePromotions = fetchedItems.percentagePromotions;
          this.percentageArray = fetchedItems.percentageArray;
          this.orderTotalPrice();
        }, error => {
          this.showError();
          loader.dismiss();
        });
      }, err => {
        this.showError();
        loader.dismiss();
      });
    }
  }

  searchForCustomer() {
    let modal = this.modalCtrl.create(SearchCustomerPage);
    modal.onDidDismiss(data => {
      if (data && data.newCustomer === true) {
        this.addNewCustomer();
      }
      else if (data) {
        this.CustomerAdded = true;
        this.customer = data;
        this.orderRequest.Datarow.CustomerID = this.customer.CardCode;
      }
    });
    modal.present();
  }

  addNewCustomer() {
    let modal = this.modalCtrl.create(AddCustomerPage);
    modal.onDidDismiss(data => {
      if (data) {
        this.CustomerAdded = true;
        this.customer = data;
        this.orderRequest.Datarow.CustomerID = this.customer.CardCode;
      }
    });
    modal.present();
  }

  onAddDesign() {
    let modal = this.modalCtrl.create(ItemsPage);
    modal.onDidDismiss(data => {
      if (data && data.mainItemSelected === true) {
        this.onAddItem(data.id);
      } else if (data && data.mainItemSelected === false) {
        this.singleItems.push({
          Count: data.count,
          HigherPrice: data.item.Price,
          ItemCode: data.item.ItemCode,
          piecePrice: data.item.Price,
          ItemName: data.item.ItemName,
          TotalPrice: data.item.Price * data.count,
          ItmsGrpCod: data.item.ItmsGrpCod,
          ItemType: 7
        });
        this.orderTotalPrice();
      }
    });
    modal.present();
  }
  onAddItem(id) {
    let data = {
      add: true,
      id: id
    }
    let modal = this.modalCtrl.create(ItemPage, data);
    modal.onDidDismiss(data => {
      if (data) {
        this.singleItems.push(data.item);
        this.orderTotalPrice();
      } else {
        this.onAddDesign();
      }
    });
    modal.present();
  }
  singleItemsTotal() {
    this.singleItemsPrice = 0;
    this.singleItems.forEach(item => {
      this.singleItemsPrice += item.TotalPrice;
    });
  }
  orderTotalPrice() {
    this.singleItemsTotal();
    this.totalPrice = 0;
    this.percentagePromotions.forEach(promotion => {
      this.totalPrice += promotion.totalPrice;
    });
    this.valuePromotions.forEach(promotion => {
      this.totalPrice += promotion.totalPrice;
    });
    this.piecePromotions.forEach(promotion => {
      this.totalPrice += promotion.totalPrice;
    });
    this.totalPrice += this.singleItemsPrice;
  }
  itemAction(i) {
    let actionSheet;
    if (this.singleItems[i].ItmsGrpCod == 104) {
      actionSheet = this.actionSheetCtrl.create({
        buttons: [
          {
            text: 'تعديل',
            handler: () => {
              this.editItem(i);
            }
          },
          {
            text: 'حذف',
            handler: () => {
              this.deleteConfirm(i);
            }
          },
          {
            text: 'إلغاء',
            role: 'cancel'
          }
        ]
      });
    } else {
      actionSheet = this.actionSheetCtrl.create({
        buttons: [
          {
            text: 'حذف',
            handler: () => {
              this.deleteConfirm(i);
            }
          },
          {
            text: 'إلغاء',
            role: 'cancel'
          }
        ]
      });
    }
    actionSheet.present();
  }
  ///////////Edit single Item/////////////
  editItem(i) {
    let data = {
      edit: true,
      list: 0,
      item: this.singleItems[i],
      deliveryDate: this.orderRequest.Datarow.OrderDeliveryDate,
      urgentDeliveryDate: this.orderRequest.Datarow.UrgentDeliveryDate,
    }
    let modal = this.modalCtrl.create(ItemPage, data);
    modal.onDidDismiss(data => {
      if (data) {
        this.singleItems.splice(i, 1);
        this.singleItems.push(data.item);
        this.orderTotalPrice();
      }
    });
    modal.present();
  }
  //////////////Edit percentage promotion////////////////
  editPromotionOrder(i, type) {
    let data: any;
    switch (type) {
      case 'percentage': {
        data = {
          mode: 'edit',
          Promotion: this.percentagePromotions[i].promotion,
          items: this.percentagePromotions[i].items,
          totalPrice: this.percentagePromotions[i].totalPrice,
          deliveryDate: this.orderRequest.Datarow.OrderDeliveryDate,
          urgentDeliveryDate: this.orderRequest.Datarow.UrgentDeliveryDate,
        }
        break;
      }
      case 'Value': {
        data = {
          mode: 'edit',
          Promotion: this.valuePromotions[i].promotion,
          items: this.valuePromotions[i].items,
          totalPrice: this.valuePromotions[i].totalPrice,
          deliveryDate: this.orderRequest.Datarow.OrderDeliveryDate,
          urgentDeliveryDate: this.orderRequest.Datarow.UrgentDeliveryDate,
        }
        break;
      }
      case 'Piece': {
        data = {
          mode: 'edit',
          Promotion: this.piecePromotions[i].promotion,
          items: this.piecePromotions[i].items,
          totalPrice: this.piecePromotions[i].totalPrice,
          deliveryDate: this.orderRequest.Datarow.OrderDeliveryDate,
          urgentDeliveryDate: this.orderRequest.Datarow.UrgentDeliveryDate,
        }
        break;
      }
      default: {
        break;
      }
    }
    let modal = this.modalCtrl.create(PromotionOrderPage, data);
    modal.onDidDismiss(response => {
      if (response) {
        if (response.promotion.PromotionTypeID == 1) { // value
          this.valuePromotions.splice(i, 1);
          this.valueArray.splice(i, 1);
          this.valuePromotions.push(response);
          this.valueArray.push(response.items);
        } else if (response.promotion.PromotionTypeID == 2) { //percentage
          this.percentagePromotions.splice(i, 1);
          this.percentageArray.splice(i, 1);
          this.percentagePromotions.push(response);
          this.percentageArray.push(response.items);
        } else if (response.promotion.PromotionTypeID == 3) { // piece
          this.piecePromotions.splice(i, 1);
          this.pieceArray.splice(i, 1);
          this.piecePromotions.push(response);
          this.pieceArray.push(response.items);
        }
        this.orderTotalPrice();
      }
    });
    modal.present();
  }
  //////////////Edit percentage promotion////////////////
  saveOrder(mode?) {
    this.saveDisable = true;
    this.disableSave = true;
    if (mode == 'park') {
      this.orderRequest.Datarow.Park = true;
    } else {
      this.orderRequest.Datarow.Park = false;
    }
    let loader = this.loadingCtrl.create({
      cssClass: 'transperant_loader'
    });
    loader.present();
    this.orderList = [];
    this.orderRequest.ListDataRow2 = [];
    this.orderRequest.Order_Type = [];
    this.singleItems.forEach(element => {
      this.orderList.push(element);
    });
    for (let i = 0; i < this.percentagePromotions.length; i++) {
      this.percentagePromotions[i].items.forEach(item => {
        item.promotionSubID = i;
        this.orderList.push(item);
        if (item.Urgent) {
          this.isUrgent = true;
        }
      });
    }
    for (let i = 0; i < this.valuePromotions.length; i++) {
      this.valuePromotions[i].items.forEach(item => {
        item.promotionSubID = i;
        this.orderList.push(item);
        if (item.Urgent) {
          this.isUrgent = true;
        }
      });
    }
    for (let i = 0; i < this.piecePromotions.length; i++) {
      this.piecePromotions[i].items.forEach(item => {
        item.promotionSubID = i;
        this.orderList.push(item);
        if (item.Urgent) {
          this.isUrgent = true;
        }
      });
    }
    this.singleItems.forEach(item => {
      if (item.Urgent) {
        this.isUrgent = true;
      }
    })
    this.orderRequest.ListDataRow2 = this.orderList;
    let types: number[] = [];
    this.orderList.forEach(element => {
      types.push(element.ItemType);
    });
    this.orderRequest.Order_Type = this.remove_duplicates(types);
    this.postService.orderRequest(this.orderRequest).subscribe(res => {
      if (res && res.SalesOrderID) {
        let alert = this.alertCtrl.create({
          title: 'تم حفظ  الفاتورة',
          message: 'رقم الفاتورة ' + res.SalesOrderID,
          buttons: [
            {
              text: 'تم',
              role: 'cancel',
              handler: () => {
                this.viewCtrl.dismiss()
              }
            }
          ]
        });
        alert.present();
        loader.dismiss();
      } else {
        this.toaster('حدث خطأ, رجاء إعادة المحاولة', false);
        loader.dismiss();
      }
    }, err => {
      console.log(err);
      this.toaster('حدث خطأ, رجاء إعادة المحاولة.', false);
      loader.dismiss();
    });
    /* this.http.setDataSerializer("json");
    this.http.post(`${this.connection.baseUrl}/Promotions/saveOrder`, this.orderRequest, {
      "content-type": "application/json",
      "Accept": 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS'
    }).then(data => {
      let resp = JSON.parse(data.data);
      if (data && resp.SalesOrderID) {
        let alert = this.alertCtrl.create({
          title: 'تم حفظ  الفاتورة',
          message: 'رقم الفاتورة ' + resp.SalesOrderID,
          buttons: [
            {
              text: 'تم',
              role: 'cancel',
              handler: () => {
                this.viewCtrl.dismiss()
              }
            }
          ]
        });
        alert.present();
        loader.dismiss();
      } else {
        this.toaster('حدث خطأ, رجاء إعادة المحاولة', false);
        loader.dismiss(); 
      }
    }).catch(err => {
      this.toaster('حدث خطأ, رجاء إعادة المحاولة', false);
      loader.dismiss();
    });*/
  }
  remove_duplicates(arr) {
    const types = Array.from(new Set(arr));
    let orderTypes: ItemsTypes[] = [];
    types.forEach(element => {
      if (element != 0) {
        orderTypes.push({ TypeId: element });
      }
    });
    return orderTypes;
  }

  calcDates(days) {
    let date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }
  onAddPromotion() {
    let data = {
      add: true
    }
    let modal = this.modalCtrl.create(PromotionsPage, data);
    modal.onDidDismiss(res => {
      if (res) {
        this.PromotionOrder(res);
      }
    });
    modal.present();
  }
  PromotionOrder(data) {
    let modal = this.modalCtrl.create(PromotionOrderPage, data);
    modal.onDidDismiss(data => {
      if (data) {
        if (data.promotion.PromotionTypeID == 1) {
          this.valuePromotions.push(data);
          this.valueArray.push(data.items);
        }
        if (data.promotion.PromotionTypeID == 2) {
          this.percentagePromotions.push(data);
          this.percentageArray.push(data.items);
        }
        if (data.promotion.PromotionTypeID == 3) {
          this.piecePromotions.push(data);
          this.pieceArray.push(data.items);
        }
        this.orderTotalPrice();
      }
    });
    modal.present();
  }

  deleteConfirm(i) {
    let alert = this.alertCtrl.create({
      message: 'هل تريد حذف الصنف؟',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel',
          handler: () => {
            console.log('Cancel clicked');
          }
        },
        {
          text: 'تأكيد',
          handler: () => {
            this.singleItems.splice(i, 1);
            this.orderTotalPrice();
          }
        }
      ]
    });
    alert.present();
  }
  showError() {
    let toast = this.ToastCtrl.create({
      message: 'حدث خطأ، رجاء أعد المحاولة لاحقا',
      position: "middle",
      showCloseButton: false,
      duration: 2000,
      dismissOnPageChange: true
    });
    toast.onDidDismiss(() => {
      this.viewCtrl.dismiss();
    });
    toast.present();
  }
  toaster(msg, dismissView) {
    let toast = this.ToastCtrl.create({
      message: msg,
      position: "middle",
      showCloseButton: false,
      duration: 2000,
      dismissOnPageChange: true
    });
    toast.onDidDismiss(() => {
      this.saveDisable = false;
      this.disableSave = false;
    });
    toast.present();
  }
  onDismiss() {
    if ((this.singleItems.length > 0 || this.percentageArray.length > 0 || this.pieceArray.length > 0 || this.valueArray.length > 0) && !this.disableSave) {
      let confirm = this.alertCtrl.create({
        title: 'إلغاء الطلب',
        message: 'تأكيد إلغاء الطلب',
        buttons: [
          {
            text: 'رفض',
            handler: () => {
            }
          },
          {
            text: 'تأكيد',
            handler: () => {
              this.viewCtrl.dismiss();
            }
          }
        ]
      });
      confirm.present();
    } else {
      this.viewCtrl.dismiss();
    }
  }
}